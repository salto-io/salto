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
  Element,
  InstanceElement,
  isInstanceElement,
  ReadOnlyElementsSource,
  Values,
  SaltoError,
} from '@salto-io/adapter-api'
import {
  createSchemeGuard,
  createSchemeGuardForInstance,
  GetLookupNameFunc,
  getParent,
  resolveValues,
  ResolveValuesFunc,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { retry } from '@salto-io/lowerdash'
import Joi from 'joi'
import { client as clientUtils } from '@salto-io/adapter-components'
import WorkatoClient from './client/client'
import { CONNECTION_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE } from './constants'
import { isChangeFromType, isInstanceFromType } from './utils'

const { withRetry } = retry
const { intervals } = retry.retryStrategies
const log = logger(module)

const MAX_RETRIES = 60
const INTERVAL_TIME = 2000
const RESTART_RECIPES_QUERY_PARAMS: Record<string, string> = { restart_recipes: 'true' }
const IMPORT_HEADER = { 'Content-Type': 'application/octet-type' }

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

const isErrorResponse = createSchemeGuard<{ error: string }>(
  Joi.object({
    error: Joi.string().required(),
  })
    .unknown(true)
    .required(),
  'Received an invalid project error response',
)

const isMessageResponse = createSchemeGuard<{ message: string }>(
  Joi.object({
    message: Joi.string().required(),
  })
    .unknown(true)
    .required(),
  'Received an invalid project message response',
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
 * Hook for treating recipe__code as recipe item while resolving.
 */
export const resolveValuesCheckRecipeFunc: ResolveValuesFunc = async <T extends Element>(
  changeData: T,
  getLookUpNameFunc: GetLookupNameFunc,
  elementSource?: ReadOnlyElementsSource,
): Promise<T> => {
  if (isInstanceElement(changeData) && isInstanceFromType([RECIPE_CODE_TYPE, RECIPE_TYPE])(changeData)) {
    const codeData = isInstanceFromType([RECIPE_CODE_TYPE])(changeData) ? changeData : changeData.value.code.value
    const recipeData = isInstanceFromType([RECIPE_TYPE])(changeData) ? changeData : getParent(changeData)
    const resolvedCodeData = await resolveValues(codeData, getLookUpNameFunc, elementSource)
    const resolvedRecipeData = await resolveValues(recipeData, getLookUpNameFunc, elementSource)
    if (isInstanceElement(resolvedRecipeData) && isInstanceFromType([RECIPE_TYPE])(resolvedRecipeData)) {
      resolvedRecipeData.value.code = resolvedCodeData.value
      return resolvedRecipeData as unknown as T
    }
  }
  return resolveValues(changeData, getLookUpNameFunc, elementSource)
}

const checkRLMImportStatus = async (client: WorkatoClient, jobId: number): Promise<boolean> => {
  const res = await client.get({ url: `/packages/${jobId}` })

  if (res.status !== 200 || !isStatusResponse(res.data)) {
    throw new Error(
      [
        "Can't get valid deploy response from Workato.",
        `id: ${jobId}`,
        `status: ${res.status}`,
        `data: ${res.data}`,
      ].join(EOL),
    )
  }

  if (res.data.status === 'failed') {
    if (isErrorResponse(res.data)) {
      throw new Error(`Deploy failed. id: ${jobId}, error message ${res.data.error}`)
    }
    throw new Error(`Deploy failed. invalid response from Workato. id: ${jobId}`)
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

const getWorkatoError = (elemList: ElemID[], error: Error): SaltoError => {
  // TODO change all to SaltoError
  const baseErrorMessage = `Deployment of the next elements failed:${elemList.map(elemId => `\n\t${elemId.getFullName()}`)}`

  if (!(error instanceof clientUtils.HTTPError)) {
    return { message: `${baseErrorMessage}\n${error}`, severity: 'Error' }
  }

  const logBaseErrorMessage = `Deployment of the next elements failed:${elemList.map(elemId => `\n\t${elemId.getFullName()}.`)}`
  log.error([logBaseErrorMessage, safeJsonStringify(error.response.data, undefined, 2)].join(' '))

  if ([400, 401, 404, 500].includes(error.response.status)) {
    const errorResponse = [
      baseErrorMessage,
      `status: ${error.response.status}`,
      `message: ${error.response.statusText}`,
    ]
    if (error.response.status === 500 && error.response.data.id !== undefined) {
      errorResponse.push(`id: ${error.response.data.id}`)
    }
    return { message: errorResponse.join(EOL), severity: 'Error' }
  }

  return {
    message: [baseErrorMessage, `${error}`, safeJsonStringify(error.response.data, undefined, 2)].join(EOL),
    severity: 'Error',
  }
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
const convertChangesToRLMFormat = (changes: Change<InstanceElement>[]): [JSZip, DeployResult] => {
  const zip = new JSZip()
  const [connectionChanges, nonConnectionChanges] = _.partition(changes, isChangeFromType([CONNECTION_TYPE]))
  const [recipeChanges, otherChanges] = _.partition(
    nonConnectionChanges,
    isChangeFromType([RECIPE_TYPE, RECIPE_CODE_TYPE]),
  )

  if (otherChanges.length !== 0) {
    return [
      zip,
      {
        appliedChanges: [],
        errors: [
          {
            message: [
              'unknwon Types for RLM',
              ...otherChanges
                .map(change => getChangeData(change))
                .map(data => `\t${data.elemID.name} from type ${data.elemID.typeName}`),
            ].join(EOL),
            severity: 'Error',
          },
        ],
      },
    ]
  }

  const [validConnections, invalidConnections] = _.partition(connectionChanges, connection =>
    isConnection(getChangeData(connection)),
  )
  const [validRecipes, invalidRecipes] = _.partition(Array.from(new Set(recipeChanges)), recipe =>
    isRecipe(getChangeData(recipe)),
  )

  validConnections.map(getChangeData).forEach(connection => connectionToZipFormat(zip, connection))
  validRecipes.map(getChangeData).forEach(recipe => recipeToZipFormat(zip, recipe))

  return [
    zip,
    {
      appliedChanges: [...validConnections, ...validRecipes],
      errors: [...invalidConnections, ...invalidRecipes].map(elem => ({
        message: [
          `Deployment of ${getChangeData(elem).elemID.getFullName()} failed:`,
          `invalid ${getChangeData(elem).elemID.typeName}`,
        ].join(EOL),
        severity: 'Error',
      })),
    },
  ]
}

const RLMImportZip = async ({
  zip,
  client,
  rootId,
  elemList,
}: {
  zip: JSZip
  client: WorkatoClient
  rootId: number
  elemList: ElemID[]
}): Promise<void> => {
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
    throw getWorkatoError(elemList, e)
  }

  if (response.status !== 200 || !isIdResponse(response.data)) {
    const errorData = ['Get invalid response from Workato', `status: ${response.status}`]
    if (isMessageResponse(response.data)) {
      errorData.push(`message: ${response.data.message}`)
    }
    throw getWorkatoError(elemList, new Error(errorData.join(EOL)))
  }

  try {
    await pollRLMImportStatus(client, response.data.id)
  } catch (e) {
    throw getWorkatoError(elemList, e)
  }
}

export const RLMDeploy = async (changes: Change<InstanceElement>[], client: WorkatoClient): Promise<DeployResult> => {
  const [zip, deployResult] = convertChangesToRLMFormat(changes)

  if (!_.isEmpty(deployResult.appliedChanges)) {
    try {
      await RLMImportZip({
        zip,
        client,
        rootId: getChangeData(changes[0]).value.folder_id.rootId,
        elemList: changes.map(change => getChangeData(change).elemID),
      })
    } catch (e) {
      return {
        appliedChanges: [],
        errors: [e, ...deployResult.errors],
      }
    }
  }
  return deployResult
}
