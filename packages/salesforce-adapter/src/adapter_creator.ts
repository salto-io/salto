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
import { collections, regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  InstanceElement, Adapter,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import SalesforceClient, { Credentials, validateCredentials } from './client/client'
import changeValidator from './change_validator'
import { getChangeGroupIds } from './group_changes'
import SalesforceAdapter from './adapter'
import { configType, credentialsType, INSTANCES_REGEX_SKIPPED_LIST, SalesforceConfig, DataManagementConfig, DATA_MANAGEMENT } from './types'

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
  const validateRegularExpressions = (listName: string, regularExpressions: string[]): void => {
    const invalidRegularExpressions = regularExpressions
      .filter(strRegex => !regex.isValidRegex(strRegex))
    if (!_.isEmpty(invalidRegularExpressions)) {
      const errMessage = `Failed to load config due to an invalid ${listName} value. The following regular expressions are invalid: ${invalidRegularExpressions}`
      log.error(errMessage)
      throw Error(errMessage)
    }
  }

  const validateDataManagement = (dataManagementConfigs: DataManagementConfig[]): void => {
    dataManagementConfigs.forEach(dataManagementConfig => {
      validateRegularExpressions(`${DATA_MANAGEMENT}.includeObjects`, makeArray(dataManagementConfig.includeObjects))
      validateRegularExpressions(`${DATA_MANAGEMENT}.excludeObjects`, makeArray(dataManagementConfig.excludeObjects))
      validateRegularExpressions(`${DATA_MANAGEMENT}.allowReferenceTo`, makeArray(dataManagementConfig.allowReferenceTo))
    })
  }

  const instancesRegexSkippedList = makeArray(config?.value?.instancesRegexSkippedList)
  validateRegularExpressions(INSTANCES_REGEX_SKIPPED_LIST, instancesRegexSkippedList)
  const dataManagementConfigs = makeArray(config?.value?.dataManagement)
  validateDataManagement(dataManagementConfigs)
  const adapterConfig = {
    metadataTypesSkippedList: makeArray(config?.value?.metadataTypesSkippedList),
    instancesRegexSkippedList: makeArray(config?.value?.instancesRegexSkippedList),
    maxConcurrentRetrieveRequests: config?.value?.maxConcurrentRetrieveRequests,
    maxItemsInRetrieveRequest: config?.value?.maxItemsInRetrieveRequest,
    enableHideTypesInNacls: config?.value?.enableHideTypesInNacls,
    dataManagement: config?.value?.dataManagement,
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknon config property was found: %s', k))
  return adapterConfig
}

const clientFromCredentials = (credentials: InstanceElement): SalesforceClient =>
  new SalesforceClient({ credentials: credentialsFromConfig(credentials) })

export const adapter: Adapter = {
  operations: context => new SalesforceAdapter({
    client: clientFromCredentials(context.credentials),
    config: adapterConfigFromConfig(context.config),
    getElemIdFunc: context.getElemIdFunc,
  }),
  validateCredentials: config => validateCredentials(
    credentialsFromConfig(config)
  ),
  credentialsType,
  configType,
  deployModifiers: {
    changeValidator,
    getChangeGroupIds,
  },
}
