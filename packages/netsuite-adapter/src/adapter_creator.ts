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
import {
  Adapter, BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, AdapterInstallResult,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { SDKDownloadService } from '@salto-io/suitecloud-cli'
import changeValidator from './change_validator'
import NetsuiteClient, { Credentials } from './client/client'
import NetsuiteAdapter, { NetsuiteConfig } from './adapter'
import { NETSUITE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST } from './constants'

const log = logger(module)
const { makeArray } = collections.array

const configID = new ElemID(NETSUITE)

const credentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accountId: { type: BuiltinTypes.STRING },
    tokenId: { type: BuiltinTypes.STRING },
    tokenSecret: { type: BuiltinTypes.STRING },
  },
  annotationTypes: {},
  annotations: {},
})

const configType = new ObjectType({
  elemID: configID,
  fields: {
    [TYPES_TO_SKIP]: {
      type: new ListType(BuiltinTypes.STRING),
    },
    [FILE_PATHS_REGEX_SKIP_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
    },
  },
})

const netsuiteConfigFromConfig = (config: Readonly<InstanceElement> | undefined):
  NetsuiteConfig => {
  const validateRegularExpressions = (regularExpressions: string[]): void => {
    const invalidRegularExpressions = regularExpressions
      .filter(regex => {
        try {
          RegExp(regex)
          return false
        } catch (e) {
          return true
        }
      })
    if (!_.isEmpty(invalidRegularExpressions)) {
      const errMessage = `Failed to load config due to an invalid ${FILE_PATHS_REGEX_SKIP_LIST} value. The following regular expressions are invalid: ${invalidRegularExpressions}`
      log.error(errMessage)
      throw Error(errMessage)
    }
  }

  const filePathsRegexSkipList = makeArray(config?.value?.[FILE_PATHS_REGEX_SKIP_LIST])
  validateRegularExpressions(filePathsRegexSkipList)
  const netsuiteConfig = {
    [TYPES_TO_SKIP]: makeArray(config?.value?.[TYPES_TO_SKIP]),
    [FILE_PATHS_REGEX_SKIP_LIST]: filePathsRegexSkipList,
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(netsuiteConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return netsuiteConfig
}

const netsuiteCredentialsFromCredentials = (credentials: Readonly<InstanceElement>): Credentials =>
  credentials.value as Credentials

const clientFromCredentials = (credentials: InstanceElement): NetsuiteClient =>
  new NetsuiteClient({
    credentials: netsuiteCredentialsFromCredentials(credentials),
  })

export const adapter: Adapter = {
  operations: context => new NetsuiteAdapter({
    client: clientFromCredentials(context.credentials),
    config: netsuiteConfigFromConfig(context.config),
    getElemIdFunc: context.getElemIdFunc,
  }),
  validateCredentials: async config => {
    const credentials = netsuiteCredentialsFromCredentials(config)
    return NetsuiteClient.validateCredentials(credentials)
  },
  credentialsType,
  configType,
  deployModifiers: {
    changeValidator,
  },
  install: async (): Promise<AdapterInstallResult> => {
    try {
      await SDKDownloadService.download()
      return { success: true, errors: [] }
    } catch (err) {
      return { success: false, errors: [err.message ?? err] }
    }
  },
}
