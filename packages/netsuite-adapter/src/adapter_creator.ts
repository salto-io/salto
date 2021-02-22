/*
*                      Copyright 2021 Salto Labs Ltd.
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
  Adapter, BuiltinTypes, ElemID, InstanceElement, ObjectType, AdapterInstallResult,
  AdapterOperationsContext, AdapterOperations,
} from '@salto-io/adapter-api'
import { collections, regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { SdkDownloadService } from '@salto-io/suitecloud-cli'
import changeValidator from './change_validator'
import { getChangeGroupIds } from './group_changes'
import NetsuiteClient from './client/client'
import NetsuiteAdapter from './adapter'
import { configType, NetsuiteConfig } from './config'
import {
  NETSUITE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, DEPLOY_REFERENCED_ELEMENTS, CLIENT_CONFIG,
  FETCH_TARGET,
  FETCH_ALL_TYPES_AT_ONCE,
  SKIP_LIST,
} from './constants'
import { validateParameters } from './query'
import { Credentials } from './client/credentials'

const log = logger(module)
const { makeArray } = collections.array

const configID = new ElemID(NETSUITE)

export const defaultCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accountId: { type: BuiltinTypes.STRING },
    tokenId: { type: BuiltinTypes.STRING },
    tokenSecret: { type: BuiltinTypes.STRING },
  },
  annotationTypes: {},
  annotations: {},
})

const netsuiteConfigFromConfig = (config: Readonly<InstanceElement> | undefined):
  NetsuiteConfig => {
  const validateRegularExpressions = (regularExpressions: string[]): void => {
    const invalidRegularExpressions = regularExpressions
      .filter(strRegex => !regex.isValidRegex(strRegex))
    if (!_.isEmpty(invalidRegularExpressions)) {
      const errMessage = `received an invalid ${FILE_PATHS_REGEX_SKIP_LIST} value. The following regular expressions are invalid: ${invalidRegularExpressions}`
      throw Error(errMessage)
    }
  }

  const fetchTargetParameters = config?.value?.[FETCH_TARGET]
  const skipListParameters = config?.value?.[SKIP_LIST]
  const filePathsRegexSkipList = config?.value?.[FILE_PATHS_REGEX_SKIP_LIST]
    && makeArray(config?.value?.[FILE_PATHS_REGEX_SKIP_LIST])
  const clientConfig = config?.value?.[CLIENT_CONFIG]
  if (clientConfig?.[FETCH_ALL_TYPES_AT_ONCE] && fetchTargetParameters !== undefined) {
    log.warn(`${FETCH_ALL_TYPES_AT_ONCE} is not supported with ${FETCH_TARGET}. Ignoring ${FETCH_ALL_TYPES_AT_ONCE}`)
    clientConfig[FETCH_ALL_TYPES_AT_ONCE] = false
  }
  try {
    if (filePathsRegexSkipList !== undefined) {
      validateRegularExpressions(filePathsRegexSkipList)
    }
    if (fetchTargetParameters !== undefined) {
      validateParameters(fetchTargetParameters)
    }

    if (skipListParameters !== undefined) {
      validateParameters(skipListParameters)
    }

    const netsuiteConfig: { [K in keyof Required<NetsuiteConfig>]: NetsuiteConfig[K] } = {
      [TYPES_TO_SKIP]: config?.value?.[TYPES_TO_SKIP] && makeArray(config?.value?.[TYPES_TO_SKIP]),
      [DEPLOY_REFERENCED_ELEMENTS]: config?.value?.[DEPLOY_REFERENCED_ELEMENTS],
      [FILE_PATHS_REGEX_SKIP_LIST]: filePathsRegexSkipList,
      [CLIENT_CONFIG]: config?.value?.[CLIENT_CONFIG],
      [FETCH_TARGET]: fetchTargetParameters,
      [SKIP_LIST]: skipListParameters,
    }

    Object.keys(config?.value ?? {})
      .filter(k => !Object.keys(netsuiteConfig).includes(k))
      .forEach(k => log.debug('Unknown config property was found: %s', k))
    return netsuiteConfig
  } catch (e) {
    e.message = `failed to load Netsuite config: ${e.message}`
    log.error(e.message)
    throw e
  }
}

const netsuiteCredentialsFromCredentials = (credentials: Readonly<InstanceElement>): Credentials =>
  credentials.value as Credentials

const getAdapterOperations = (context: AdapterOperationsContext): AdapterOperations => {
  const adapterConfig = netsuiteConfigFromConfig(context.config)
  const credentials = netsuiteCredentialsFromCredentials(context.credentials)
  return new NetsuiteAdapter({
    client: new NetsuiteClient({ credentials, config: adapterConfig[CLIENT_CONFIG] }),
    elementsSource: context.elementsSource,
    config: adapterConfig,
    getElemIdFunc: context.getElemIdFunc,
  })
}

export const adapter: Adapter = {
  operations: context => getAdapterOperations(context),
  validateCredentials: async config => {
    const credentials = netsuiteCredentialsFromCredentials(config)
    return NetsuiteClient.validateCredentials(credentials)
  },
  authenticationMethods: {
    basic: {
      credentialsType: defaultCredentialsType,
    },
  },
  configType,
  deployModifiers: {
    changeValidator,
    getChangeGroupIds,
  },
  install: async (): Promise<AdapterInstallResult> => {
    try {
      return await SdkDownloadService.download()
    } catch (err) {
      return { success: false, errors: [err.message ?? err] }
    }
  },
}
