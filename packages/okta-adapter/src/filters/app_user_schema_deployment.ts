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
import _ from 'lodash'
import Joi from 'joi'
import {
  Change,
  InstanceElement,
  isInstanceChange,
  getChangeData,
  toChange,
  isAdditionChange,
  AdditionChange,
  ModificationChange,
  isModificationChange,
  ElemID,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  definitions as definitionsUtils,
  fetch as fetchUtils,
} from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, getParents, resolvePath, setPath } from '@salto-io/adapter-utils'
import { APP_USER_SCHEMA_TYPE_NAME } from '../constants'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployWithStatus } from '../deployment'
import { BASE_PATH } from '../change_validators/app_user_schema_base_properties'

const log = logger(module)

type AppUserSchema = {
  id: string
}

const AppUserSchemaSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(true)

const isAppUserSchema = createSchemeGuard<AppUserSchema>(
  AppUserSchemaSchema,
  'Recieved invalid app user schema response',
)

const isAppUserSchemaChange = (change: Change): change is Change<InstanceElement> =>
  isInstanceChange(change) && getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME

const getAutoCreatedAppUserSchema = async (
  applicationId: string,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<AppUserSchema> => {
  const url = `/api/v1/meta/schemas/apps/${applicationId}/default`
  const autoCreatedAppUserSchema = (await client.get({ url })).data
  if (!isAppUserSchema(autoCreatedAppUserSchema)) {
    log.error(`Recieved invalid app user schema response from endpoint: ${url}`)
    throw new Error('Invalid app user schema response')
  }
  return autoCreatedAppUserSchema
}

const verifyApplicationIsDeleted = async (
  applicationId: string,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<boolean> => {
  try {
    return (
      (
        await client.get({
          url: `/api/v1/apps/${applicationId}`,
        })
      ).status === 404
    )
  } catch (error) {
    if (error instanceof clientUtils.HTTPError && error.response?.status === 404) {
      return true
    }
    throw error
  }
}

const getAppUserSchemaInstance = (
  autoCreatedappUserSchema: AppUserSchema,
  appUserSchemaInstance: InstanceElement,
  fieldsToOmit: string[],
): InstanceElement => {
  const createdAppUserSchemaInstance = appUserSchemaInstance.clone()
  createdAppUserSchemaInstance.value = _.omit(autoCreatedappUserSchema, [...Object.keys(fieldsToOmit), 'name'])
  return createdAppUserSchemaInstance
}

const makeModificationFromAddition = async (
  change: AdditionChange<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  fieldsToOmit: string[],
): Promise<ModificationChange<InstanceElement>> => {
  const appUserSchemaInstance = getChangeData(change)
  const parentApplicationId = getParents(appUserSchemaInstance)[0]?.id
  if (parentApplicationId === undefined) {
    log.error(`Error while trying to get parent id for AppUserSchema ${appUserSchemaInstance.elemID.getFullName()}`)
    throw new Error(
      `Could not find parent application id for AppUserSchema ${appUserSchemaInstance.elemID.name} from type ${appUserSchemaInstance.elemID.typeName}`,
    )
  }

  const autoCreatedAppUserSchema = await getAutoCreatedAppUserSchema(parentApplicationId, client)

  // Assign the id created by the service to the app user schema
  appUserSchemaInstance.value.id = autoCreatedAppUserSchema.id

  const autoCreatedAppUserSchemaInstance = getAppUserSchemaInstance(
    autoCreatedAppUserSchema,
    appUserSchemaInstance,
    fieldsToOmit,
  )
  return { action: 'modify', data: { before: autoCreatedAppUserSchemaInstance, after: appUserSchemaInstance.clone() } }
}

const getBaseElemID = (appUserSchemaInstance: InstanceElement): ElemID =>
  appUserSchemaInstance.elemID.createNestedID(...BASE_PATH)

const deployModificationChange = async (
  change: ModificationChange<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const { before } = change.data
  const after = change.data.after.clone()
  const beforeBaseElemId = getBaseElemID(before)
  setPath(after, getBaseElemID(after), resolvePath(before, beforeBaseElemId))
  await defaultDeployWithStatus(toChange({ before, after }), client, apiDefinitions)
}

const deployAdditionChange = async (
  change: AdditionChange<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  fieldsToOmit: string[],
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const modifiedChange = await makeModificationFromAddition(change, client, fieldsToOmit)
  return deployModificationChange(modifiedChange, client, apiDefinitions)
}

const deployRemovalChange = async (
  change: Change,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<void> => {
  const appUserSchemaInstance = getChangeData(change)
  const parentApplicationId = getParents(appUserSchemaInstance)[0]?.id
  if (!_.isString(parentApplicationId) || !(await verifyApplicationIsDeleted(parentApplicationId, client))) {
    throw new Error('Expected the parent Application to be deleted')
  }
}

const deployChange = async <Options extends definitionsUtils.APIDefinitionsOptions = {}>(
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  definitions: definitionsUtils.ApiDefinitions<Options>,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  if (isAdditionChange(change)) {
    const fieldsToOmit = fetchUtils.element.getFieldsToOmit(definitions, APP_USER_SCHEMA_TYPE_NAME)
    return deployAdditionChange(change, client, fieldsToOmit, apiDefinitions)
  }
  if (isModificationChange(change)) {
    return deployModificationChange(change, client, apiDefinitions)
  }
  return deployRemovalChange(change, client)
}

/**
 * Deploy changes of appUserSchema.
 * additions - changing them to modification changes,
 * because appUserSchema automatically created by the service when deploying new Application
 * modifications - changing the base field to the original value because Okta's API doesn't support changing it
 * removals - verifying the parent application is deleted. appUserSchema is deleted if and only if the parent application is deleted
 */
const filterCreator: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'appUserSchemaDeploymentFilter',
  deploy: async changes => {
    const client = definitions.clients.options.main.httpClient
    const [relevantChanges, leftoverChanges] = _.partition(changes, isAppUserSchemaChange)

    const deployResult = await deployChanges(relevantChanges, async change =>
      deployChange(change, client, definitions, oldApiDefinitions[API_DEFINITIONS_CONFIG]),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
