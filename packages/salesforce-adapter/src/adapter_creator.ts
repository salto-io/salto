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
  InstanceElement, AdapterCreator,
} from '@salto-io/adapter-api'
import SalesforceClient, { Credentials, validateCredentials } from './client/client'
import changeValidator from './change_validator'
import SalesforceAdapter from './adapter'
import { configType, credentialsType, SalesforceConfig } from './types'

const { makeArray } = collections.array
const log = logger(module)

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
    hideTypesInNacls: config?.value?.hideTypesInNacls,
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
  validateCredentials: config => validateCredentials(
    credentialsFromConfig(config)
  ),
  credentialsType,
  configType,
  changeValidator,
}
