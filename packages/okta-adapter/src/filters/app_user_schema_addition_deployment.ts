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
  isAdditionChange,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { getParents, transformValues } from '@salto-io/adapter-utils'
import { APP_USER_SCHEMA_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployWithStatus } from '../deployment'

const log = logger(module)

const findDifferences = (object1: Value, object2: Value): Value => {
  const differences: Value = {}

  _.forEach(object1, (value, key) => {
    if (!_.isEqual(value, object2[key])) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      differences[key] = _.isObject(value) && _.isObject(object2[key]) ? findDifferences(value, object2[key]) : value
    }
  })

  return differences
}

type AppUserSchema = {
  id: string
}

const AppUserSchemaSchema = Joi.object({
  id: Joi.string().required(),
}).unknown(true)

const isAppUserSchema = (values: unknown): values is AppUserSchema => {
  const { error } = AppUserSchemaSchema.validate(values)
  return _.isUndefined(error)
}

const getAutoCreatedAppUserSchema = async (applicationId: string, client: OktaClient): Promise<AppUserSchema> => {
  const url = `/api/v1/meta/schemas/apps/${applicationId}/default`
  const autoCreatedAppUserSchema = (await client.get({ url })).data
  if (!isAppUserSchema(autoCreatedAppUserSchema)) {
    log.error(`Recieved invalid app user schema response from endpoint: ${url}`)
    throw new Error('Invalid app user schema response')
  }
  return autoCreatedAppUserSchema
}

const getAppUserSchemaInstance = (
  autoCreatedappUserSchema: AppUserSchema,
  appUserSchemaInstance: InstanceElement,
  apiDefinitions: OktaSwaggerApiConfig,
): InstanceElement => {
  const createdAppUserSchemaInstance = appUserSchemaInstance.clone()
  // TODO: how to create the instance using the transformation config?
  const { fieldsToOmit } = configUtils.getTypeTransformationConfig(
    createdAppUserSchemaInstance.elemID.typeName,
    apiDefinitions.types,
    apiDefinitions.typeDefaults,
  )
  createdAppUserSchemaInstance.value = _.omit(autoCreatedappUserSchema, [
    ...(fieldsToOmit ?? []).map(field => field.fieldName),
    'name',
  ])
  return createdAppUserSchemaInstance
}

const deployAppUserSchemaAddition = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const appUserSchemaInstance = getChangeData(change)
  const parentApplicationId = getParents(appUserSchemaInstance)[0]?.id
  if (parentApplicationId === undefined) {
    log.error(`Error while trying to get parent id for user schema ${appUserSchemaInstance.elemID.getFullName()}`)
    throw new Error(
      `Could not find parent application id for user schema ${appUserSchemaInstance.elemID.name} from type ${appUserSchemaInstance.elemID.typeName}`,
    )
  }
  const autoCreatedAppUserSchema = await getAutoCreatedAppUserSchema(parentApplicationId, client)

  // Assign the id created by the service to the app user schema

  const autoCreatedAppUserSchemaInstance = getAppUserSchemaInstance(
    autoCreatedAppUserSchema,
    appUserSchemaInstance,
    apiDefinitions,
  )

  appUserSchemaInstance.value.id = autoCreatedAppUserSchema.id

  // appUserSchemaInstance.value.definitions.custom.properties = {}

  if (appUserSchemaInstance.isEqual(autoCreatedAppUserSchemaInstance)) {
    return
  }

  const bla = findDifferences(appUserSchemaInstance, autoCreatedAppUserSchemaInstance)
  log.debug(bla)

  const removedEmpty = await transformValues({
    values: autoCreatedAppUserSchemaInstance.value,
    type: await autoCreatedAppUserSchemaInstance.getType(),
    transformFunc: ({ value }) => value,
    strict: false,
    allowEmpty: false,
  })
  if (removedEmpty) {
    autoCreatedAppUserSchemaInstance.value = removedEmpty
  }

  const bla2 = findDifferences(appUserSchemaInstance, autoCreatedAppUserSchemaInstance)
  log.debug(bla2)

  if (appUserSchemaInstance.isEqual(autoCreatedAppUserSchemaInstance)) {
    return
  }

  await defaultDeployWithStatus(
    toChange({ before: autoCreatedAppUserSchemaInstance, after: appUserSchemaInstance }),
    client,
    apiDefinitions,
  )
}

/**
 * Deploy addition changes of appUserSchema by changing them to modification changes,
 * because appUserSchema automatically created by the service when deploying new Application
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'appUserSchemaAdditionDeployment',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionChange(change) &&
        getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change =>
      deployAppUserSchemaAddition(change, client, config[API_DEFINITIONS_CONFIG]),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
