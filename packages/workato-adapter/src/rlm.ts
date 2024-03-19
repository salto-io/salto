/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EOL } from 'os'
import _ from 'lodash'
import * as path from 'path'
import JSZip from 'jszip'
import { logger } from '@salto-io/logging'
import {
  Change,
  DeployResult,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  Values,
  SaltoError,
  Value,
  createSaltoElementError,
  SaltoElementError,
  isSaltoError,
} from '@salto-io/adapter-api'
import {
  createSchemeGuard,
  createSchemeGuardForInstance,
  getParent,
  ResolveValuesFunc,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { retry } from '@salto-io/lowerdash'
import Joi from 'joi'
import { client as clientUtils, resolveValues } from '@salto-io/adapter-components'
import WorkatoClient from './client/client'
import { CONNECTION_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE } from './constants'

const { withRetry } = retry
const { intervals } = retry.retryStrategies
const log = logger(module)

// MAX_RETRIES and INTERVAL_TIME are used for polling the import status.
// We might want to change these values to adjust the polling behavior.
const MAX_RETRIES = 10
const INTERVAL_TIME = 1000
const IMPORT_HEADER = { 'Content-Type': 'application/octet-type' }

// using RESTART_RECIPES_QUERY_PARAMS to restart recipes after import.
// this is guarantee that the recipes will be restarted after the import.
// otherwise, we will get an error while trying to deploy running recipe.
const RESTART_RECIPES_QUERY_PARAMS: Record<string, string> = { restart_recipes: 'true' }

type JsonRecipeConfigAccountID = {
  // eslint-disable-next-line camelcase
  zip_name: string
  name: string
  folder: string
}

type JsonRecipeConfig = {
  keyword: string
  provider: string
  // eslint-disable-next-line camelcase
  skip_validation: boolean
  // eslint-disable-next-line camelcase
  account_id: JsonRecipeConfigAccountID | null
}

type JsonRecipe = {
  name: string
  description: string
  version: number
  private?: boolean
  concurrency?: number
  code: Values
  config: JsonRecipeConfig[]
}

type Folder = {
  folderParts: Array<string>
  id: number
  rootId: number
}

type Connection = {
  id: number
  name: string
  // eslint-disable-next-line camelcase
  folder_id: Folder
  application: string
}

type RecipeConfig = {
  // eslint-disable-next-line camelcase
  account_id: Connection
  keyword: string
  provider: string
  // eslint-disable-next-line camelcase
  skip_validation: boolean
}

const getRootID = (change: Change<InstanceElement>): number | SaltoElementError => {
  const someChange = getChangeData(change)
  const someFolder = someChange.value.folder_id
  if (someFolder === undefined) {
    log.error('folder_id of element %s is undefined', someChange.elemID.getFullName())
    return createSaltoElementError({
      message: 'Salto broken element',
      severity: 'Error',
      elemID: someChange.elemID,
    })
  }
  if (someFolder.rootId === undefined) {
    log.error('folder %s has no root folder', someFolder.elemID.getFullName())
    return createSaltoElementError({
      message: 'Salto broken folder element',
      severity: 'Error',
      elemID: someFolder.elemID,
    })
  }
  return someFolder.rootId
}

const halfSnakeCase = (str: string): string => str.replace(/\s+/g, '_').toLowerCase()
const getFullPath = (elem: InstanceElement): string =>
  path.join(...elem.value.folder_id.folderParts, `${halfSnakeCase(elem.value.name)}.${elem.elemID.typeName}.json`)

const isIdResponse = createSchemeGuard<{ id: number }>(
  Joi.object({
    id: Joi.number().required(),
  })
    .unknown(true)
    .required(),
  'Received an invalid project id response',
)

const isStatusResponse = createSchemeGuard<{ status: string }>(
  Joi.object({
    status: Joi.string().required(),
  })
    .unknown(true)
    .required(),
  'Received an invalid project status response',
)

const CONNECTION_SCHEMA = Joi.object({
  name: Joi.string().required(),
  application: Joi.string().required(),
  folder_id: Joi.any().required(),
}).unknown(true)

const RECIPE_CONFIG_SCHEMA = Joi.array().items(
  Joi.object({
    account_id: CONNECTION_SCHEMA.required(),
    keyword: Joi.string().required(),
    provider: Joi.string().required(),
    skip_validation: Joi.boolean().required(),
  })
    .unknown(true)
    .required(),
)

const RECIPE_SCHEMA = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  version_no: Joi.number().required(),
  code: Joi.any().required(),
  config: RECIPE_CONFIG_SCHEMA.required(),
}).unknown(true)

export const isConnection = createSchemeGuardForInstance<Connection & InstanceElement>(
  CONNECTION_SCHEMA.required(),
  'Received an invalid value for connection',
)

export const isRecipe = createSchemeGuardForInstance<JsonRecipe & InstanceElement>(
  RECIPE_SCHEMA.required(),
  'Received an invalid value for recipe',
)

/**
 * Resolve the values of the given change data.
 * For recipe and recipe code types, we resolve the values of the recipe and the code separately.
 * We then merge the code values into the recipe values.
 */
export const resolveWorkatoValues: ResolveValuesFunc = async (
  element,
  getLookUpNameFunc,
  elementSource,
): Promise<Value> => {
  if (isInstanceElement(element) && [RECIPE_CODE_TYPE, RECIPE_TYPE].includes(element.elemID.typeName)) {
    const codeData = element.elemID.typeName === RECIPE_CODE_TYPE ? element : element.value.code.value
    const recipeData = element.elemID.typeName === RECIPE_TYPE ? element : getParent(element)
    const resolvedCodeData = await resolveValues(codeData, getLookUpNameFunc, elementSource)
    const resolvedRecipeData = await resolveValues(recipeData, getLookUpNameFunc, elementSource)
    if (isInstanceElement(resolvedRecipeData) && resolvedRecipeData.elemID.typeName === RECIPE_TYPE) {
      resolvedRecipeData.value.code = resolvedCodeData.value
      return resolvedRecipeData
    }
  }
  return resolveValues(element, getLookUpNameFunc, elementSource)
}

const logNetworkError = (error: Error): void => {
  if (error instanceof clientUtils.HTTPError && [400, 401, 404, 500].includes(error.response.status)) {
    log.error(
      [
        'Network error while trying to communicate with Workato',
        `status: ${error.response.status}`,
        `message: ${error.response.statusText}`,
        `data: ${safeJsonStringify(error.response.data)}`,
        error.response.status === 500 && error.response.data.id ? `id: ${error.response.data.id}` : '',
      ].join(EOL),
    )
  }
}

const checkRLMImportStatus = async (client: WorkatoClient, jobId: number): Promise<boolean> => {
  let res
  try {
    res = await client.get({ url: `/packages/${jobId}` })
  } catch (e) {
    logNetworkError(e as Error)
    throw new Error('Error while waiting for workato import status')
  }

  if (res.status !== 200 || !isStatusResponse(res.data)) {
    log.error(
      ['Get invalid response from Workato', `status: ${res.status}`, `id: ${jobId}`, `data: ${res.data}`].join(EOL),
    )
    throw new Error('Error while waiting for workato import status')
  }

  if (res.data.status === 'failed') {
    log.error(['Import failed', `id: ${jobId}`, `data: ${res.data}`].join(EOL))
    throw new Error('Workato import failed')
  }
  // when status is not 'completed' ('in progress' apperantly) we want to continue polling
  return res.data.status === 'completed'
}

const pollRLMImportStatus = async (client: WorkatoClient, jobId: number): Promise<void> => {
  await withRetry(() => checkRLMImportStatus(client, jobId), {
    strategy: intervals({
      maxRetries: MAX_RETRIES,
      interval: INTERVAL_TIME,
    }),
  })
}

const getWorkatoErrors = (elemList: ElemID[], error: Error): SaltoError[] => {
  log.error(`Deployment of the next elements failed:${elemList.map(elemId => `\n\t${elemId.getFullName()}`)}\n${error}`)

  return elemList.map(elem =>
    createSaltoElementError({
      message: error.message === undefined ? 'Deployment failed' : error.message,
      severity: 'Error',
      elemID: elem,
    }),
  )
}

const recipeToZipFormat = async (zip: JSZip, recipe: InstanceElement): Promise<void> => {
  const configList = recipe.value.config.map((conf: RecipeConfig) => ({
    keyword: conf.keyword,
    provider: conf.provider,
    skip_validation: conf.skip_validation,
    // eslint-disable-next-line camelcase
    account_id:
      conf.account_id !== undefined
        ? {
            zip_name: path.join(
              ...conf.account_id.folder_id.folderParts,
              `${halfSnakeCase(conf.account_id.name)}.connection.json`,
            ),
            name: conf.account_id.name,
            folder:
              conf.account_id.folder_id.folderParts.length !== 0
                ? path.join(...conf.account_id.folder_id.folderParts)
                : '',
          }
        : null,
  }))

  const jsonRecipe: JsonRecipe = {
    name: recipe.value.name,
    description: recipe.value.description,
    version: recipe.value.version_no,
    code: recipe.value.code,
    config: recipe.value.config !== undefined ? configList : [],
  }

  log.debug(getFullPath(recipe), jsonRecipe)
  zip.file(getFullPath(recipe), JSON.stringify(jsonRecipe, null, 1))
}

const connectionToZipFormat = (zip: JSZip, connection: InstanceElement): void => {
  zip.file(
    getFullPath(connection),
    JSON.stringify(
      {
        name: connection.value.name,
        provider: connection.value.application,
        root_folder: connection.value.folder_id.folderParts.length === 0,
      },
      null,
      1,
    ),
  )
}

/**
 * Convert elements to RLM zipped folder arrangment.
 * changes should be only connection or recipe changes (recipeCode merge into recipeFile while resolving)
 * return zip of converted files
 */
const convertChangesToRLMFormat = (
  changes: Change<InstanceElement>[],
): { zip: JSZip; changes: Change<InstanceElement>[]; erroredElements: ElemID[] } => {
  const zip = new JSZip()
  const [connectionChanges, nonConnectionChanges] = _.partition(
    changes,
    change => getChangeData(change).elemID.typeName === CONNECTION_TYPE,
  )
  const [recipeChanges, otherChanges] = _.partition(nonConnectionChanges, change =>
    [RECIPE_TYPE, RECIPE_CODE_TYPE].includes(getChangeData(change).elemID.typeName),
  )

  if (otherChanges.length !== 0) {
    const unknownTypesElements = otherChanges.map(change => getChangeData(change)).map(data => data.elemID)

    log.error(
      'unknwon Types for RLM',
      unknownTypesElements.map(elem => `\t${elem.name} from type ${elem.typeName}`),
    )

    return { zip, changes: [], erroredElements: unknownTypesElements }
  }

  const [validConnections, invalidConnections] = _.partition(connectionChanges, connection =>
    isConnection(getChangeData(connection)),
  )
  const [validRecipes, invalidRecipes] = _.partition(Array.from(new Set(recipeChanges)), recipe =>
    isRecipe(getChangeData(recipe)),
  )

  validConnections.map(getChangeData).forEach(connection => connectionToZipFormat(zip, connection))
  validRecipes.map(getChangeData).forEach(recipe => recipeToZipFormat(zip, recipe))

  const invalidElements = [...invalidConnections, ...invalidRecipes].map(change => getChangeData(change).elemID)

  log.error(['invalid workato elements:', ...invalidElements.map(elem => elem.getFullName())].join(EOL))

  return { zip, changes: [...validConnections, ...validRecipes], erroredElements: invalidElements }
}

/**
 * We use the Recipe Lifecycle Management (RLM) API to deploy recipes to Workato.
 * The RLM API give us the ability to "import" a zip file containing the recipes we want to deploy.
 * The zip file should contain the recipes and connections in a specific format and folder structure.
 *
 * @param zip - The zip file containing the recipes and connections we want to deploy.
 * @param client - The Workato client to use for the deployment.
 * @param rootId - The root folder id to deploy the recipes to.
 *
 * @throws {Error} - If the deployment fails.
 *
 * @returns {Promise<void>} - A promise that resolves when the deployment is complete.
 *
 */
const RLMImportZip = async ({
  zip,
  client,
  rootId,
}: {
  zip: JSZip
  client: WorkatoClient
  rootId: number
}): Promise<Error | undefined> => {
  const content = await zip.generateAsync({ type: 'nodebuffer' })
  const url = `/packages/import/${rootId}`

  let response
  try {
    response = await client.post({
      url,
      queryParams: RESTART_RECIPES_QUERY_PARAMS,
      headers: IMPORT_HEADER,
      data: content,
    })
  } catch (e) {
    logNetworkError(e as Error)
    return new Error('Workato import request failed')
  }

  if (response.status !== 200 || !isIdResponse(response.data)) {
    log.error(['Get invalid response from Workato', `status: ${response.status}`, `data: ${response.data}`].join(EOL))
    return new Error('Invalid response from Workato')
  }

  try {
    await pollRLMImportStatus(client, response.data.id)
  } catch (e) {
    return e as Error
  }
  return undefined
}

export const RLMDeploy = async (changes: Change<InstanceElement>[], client: WorkatoClient): Promise<DeployResult> => {
  const { zip, changes: convertedFormatChanges, erroredElements } = convertChangesToRLMFormat(changes)
  const convertedFormatErrors = !_.isEmpty(erroredElements)
    ? getWorkatoErrors(erroredElements, new Error('invalid Workato elements'))
    : []

  if (_.isEmpty(convertedFormatChanges)) {
    return {
      appliedChanges: [],
      errors: convertedFormatErrors,
    }
  }

  // rootId is the root folder id.
  // We use the root folder for deploying the recipes to Workato.
  // There is only one root folder for each environment.
  // So we take the root folder id from the first change.
  const rootId = getRootID(convertedFormatChanges[0])
  if (isSaltoError(rootId)) {
    return {
      appliedChanges: [],
      errors: [rootId, ...convertedFormatErrors],
    }
  }

  const error = await RLMImportZip({
    zip,
    client,
    rootId,
  })
  if (error !== undefined) {
    return {
      appliedChanges: [],
      errors: [
        ...getWorkatoErrors(
          changes.map(change => getChangeData(change).elemID),
          error,
        ),
        ...convertedFormatErrors,
      ],
    }
  }

  return {
    appliedChanges: convertedFormatChanges,
    errors: convertedFormatErrors,
  }
}
