/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  BuiltinTypes, ObjectType, ElemID, InstanceElement, Field, AdapterCreator,
  CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS, ListType,
} from '@salto-io/adapter-api'
import SalesforceClient, { Credentials, validateCredentials } from './client/client'
import * as constants from './constants'
import { changeValidator } from './change_validator'
import { dependencyChanger } from './dependency_changer'
import SalesforceAdapter, { SalesforceConfig } from './adapter'

const { makeArray } = collections.array
const log = logger(module)

const configID = new ElemID('salesforce')

const credentialsType = new ObjectType({
  elemID: configID,
  fields: {
    username: new Field(configID, 'username', BuiltinTypes.STRING),
    password: new Field(configID, 'password', BuiltinTypes.STRING),
    token: new Field(configID, 'token', BuiltinTypes.STRING,
      { message: 'Token (empty if your org uses IP whitelisting)' }),
    sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
  },
})

const configType = new ObjectType({
  elemID: configID,
  fields: {
    metadataTypesSkippedList: new Field(
      configID,
      'metadataTypesSkippedList',
      new ListType(BuiltinTypes.STRING),
      {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    ),
    instancesRegexSkippedList: new Field(
      configID,
      'instancesRegexSkippedList',
      new ListType(BuiltinTypes.STRING),
      {
        [CORE_ANNOTATIONS.DEFAULT]: [],
      },
    ),
    maxConcurrentRetrieveRequests: new Field(
      configID,
      'maxConcurrentRetrieveRequests',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_CONCURRENT_RETRIEVE_REQUESTS,
        [CORE_ANNOTATIONS.RESTRICTION]: {
          [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true,
          [RESTRICTION_ANNOTATIONS.MIN]: 1,
          [RESTRICTION_ANNOTATIONS.MAX]: 25,
        },
      },
    ),
    maxItemsInRetrieveRequest: new Field(
      configID,
      'maxItemsInRetrieveRequest',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.DEFAULT]: constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
        [CORE_ANNOTATIONS.RESTRICTION]: {
          [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true,
          [RESTRICTION_ANNOTATIONS.MIN]: 1000,
          [RESTRICTION_ANNOTATIONS.MAX]: 10000,
        },
      },
    ),
  },
})

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  username: config.value.username,
  password: config.value.password,
  apiToken: config.value.token,
  isSandbox: config.value.sandbox,
})

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined):
SalesforceConfig => {
  const adapterConfig = {
    metadataTypesSkippedList: makeArray(config?.value?.metadataTypesSkippedList),
    instancesRegexSkippedList: makeArray(config?.value?.instancesRegexSkippedList),
    maxConcurrentRetrieveRequests: config?.value?.maxConcurrentRetrieveRequests,
    maxItemsInRetrieveRequest: config?.value?.maxItemsInRetrieveRequest,
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknon config property was found: %s', k))
  return adapterConfig
}

const clientFromCredentials = (credentials: InstanceElement): SalesforceClient =>
  new SalesforceClient({ credentials: credentialsFromConfig(credentials) })

export const creator: AdapterCreator = {
  create: opts => new SalesforceAdapter({
    client: clientFromCredentials(opts.credentials),
    config: adapterConfigFromConfig(opts.config),
    getElemIdFunc: opts.getElemIdFunc,
  }),
  validateConfig: config => validateCredentials(credentialsFromConfig(config)),
  credentialsType,
  configType,
  changeValidator,
  dependencyChanger,
}
