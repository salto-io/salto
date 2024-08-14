/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import {
  Change,
  InstanceElement,
  isInstanceChange,
  getChangeData,
  isAdditionChange,
  AdditionChange,
  ModificationChange,
  RemovalChange,
  isAdditionOrRemovalChange,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  definitions as definitionsUtils,
  fetch as fetchUtils,
} from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, getParents } from '@salto-io/adapter-utils'
import { APP_USER_SCHEMA_TYPE_NAME } from '../constants'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployWithStatus } from '../deprecated_deployment'
import { makeSchemaDeployable } from './schema_deployment'
import { OktaOptions } from '../definitions/types'

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

const isAppUserSchemaAdditionOrRemovalChange = (
  change: Change,
): change is AdditionChange<InstanceElement> | RemovalChange<InstanceElement> =>
  isAdditionOrRemovalChange(change) &&
  isInstanceChange(change) &&
  getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME

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
  createdAppUserSchemaInstance.value = _.omit(autoCreatedappUserSchema, fieldsToOmit)
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
  return {
    action: 'modify',
    data: { before: autoCreatedAppUserSchemaInstance, after: appUserSchemaInstance.clone() },
  }
}

const deployAdditionChange = async (
  change: AdditionChange<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  definitions: definitionsUtils.ApiDefinitions<OktaOptions>,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const fieldsToOmit = fetchUtils.element.getFieldsToOmit(definitions, APP_USER_SCHEMA_TYPE_NAME)
  const modifiedChange = await makeModificationFromAddition(change, client, fieldsToOmit)
  makeSchemaDeployable(modifiedChange, {})
  await defaultDeployWithStatus(modifiedChange, client, apiDefinitions)
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

/**
 * Deploy changes of appUserSchema.
 * additions - changing them to modification changes,
 * because appUserSchema automatically created by the service when deploying new Application
 * removals - verifying the parent application is deleted. appUserSchema is deleted if and only if the parent application is deleted
 */
const filterCreator: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'appUserSchemaAdditionAndRemovalFilter',
  deploy: async changes => {
    const client = definitions.clients.options.main.httpClient
    const [relevantChanges, leftoverChanges] = _.partition(changes, isAppUserSchemaAdditionOrRemovalChange)

    const deployResult = await deployChanges(relevantChanges, async change => {
      if (isAdditionChange(change)) {
        return deployAdditionChange(change, client, definitions, oldApiDefinitions[API_DEFINITIONS_CONFIG])
      }
      return deployRemovalChange(change, client)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
