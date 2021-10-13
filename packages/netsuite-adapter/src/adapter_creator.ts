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
import { Adapter, BuiltinTypes, ElemID, InstanceElement, ObjectType, AdapterInstallResult, AdapterOperationsContext, AdapterOperations } from '@salto-io/adapter-api'
import { collections, regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { SdkDownloadService } from '@salto-io/suitecloud-cli'
import Bottleneck from 'bottleneck'
import { configType, DEFAULT_CONCURRENCY, NetsuiteConfig, validateDeployParams } from './config'
import {
  NETSUITE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, CLIENT_CONFIG,
  FETCH_TARGET,
  FETCH_ALL_TYPES_AT_ONCE,
  SKIP_LIST,
  SUITEAPP_CLIENT_CONFIG,
  USE_CHANGES_DETECTION,
  CONCURRENCY_LIMIT,
  FETCH,
  INCLUDE,
  EXCLUDE,
  DEPLOY,
  DEPLOY_REFERENCED_ELEMENTS,
  INSTALLED_SUITEAPPS,
  LOCKED_ELEMENTS_TO_EXCLUDE,
} from './constants'
import { validateFetchParameters, convertToQueryParams } from './query'
import { Credentials, toCredentialsAccountId } from './client/credentials'
import SuiteAppClient from './client/suiteapp_client/suiteapp_client'
import SdfClient from './client/sdf_client'
import NetsuiteClient from './client/client'
import NetsuiteAdapter from './adapter'

const log = logger(module)
const { makeArray } = collections.array

const configID = new ElemID(NETSUITE)
// Taken from https://github.com/salto-io/netsuite-suitecloud-sdk/blob/e009e0eefcd918635353d093be6a6c2222d223b8/packages/node-cli/src/validation/InteractiveAnswersValidator.js#L27
const SUITEAPP_ID_FORMAT_REGEX = /^[a-z0-9]+(\.[a-z0-9]+){2}$/

// The SuiteApp fields are commented out until we will be ready to expose them to the user
export const defaultCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accountId: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Account ID' },
    },
    tokenId: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'SDF Token ID' },
    },
    tokenSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'SDF Token Secret' },
    },
    suiteAppTokenId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Salto SuiteApp Token ID (empty if Salto SuiteApp is not installed)',
      },
    },
    suiteAppTokenSecret: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Salto SuiteApp Token Secret (empty if Salto SuiteApp is not installed)',
      },
    },
  },
  annotationRefsOrTypes: {},
  annotations: {},
})

const validateInstalledSuiteApps = (installedSuiteApps: unknown): void => {
  if (!Array.isArray(installedSuiteApps)
    || installedSuiteApps.some(suiteApp => typeof suiteApp !== 'string')) {
    throw Error(`received an invalid ${INSTALLED_SUITEAPPS} value: ${installedSuiteApps}`)
  }

  const invalidValues = installedSuiteApps.filter(id => !SUITEAPP_ID_FORMAT_REGEX.test(id))
  if (invalidValues.length !== 0) {
    throw Error(`${INSTALLED_SUITEAPPS} values should contain only lowercase characters or numbers and exactly two dots (such as com.saltoio.salto). The following values are invalid: ${invalidValues.join(', ')}`)
  }
}

const getFilePathRegexSkipList = (config: Readonly<InstanceElement> |
  undefined): string[] | undefined => config?.value?.[FILE_PATHS_REGEX_SKIP_LIST]
    && makeArray(config?.value?.[FILE_PATHS_REGEX_SKIP_LIST])

const validateConfig = (config: Readonly<InstanceElement> | undefined):
  void => {
  const validateRegularExpressions = (regularExpressions: string[]): void => {
    const invalidRegularExpressions = regularExpressions
      .filter(strRegex => !regex.isValidRegex(strRegex))
    if (!_.isEmpty(invalidRegularExpressions)) {
      const errMessage = `received an invalid ${FILE_PATHS_REGEX_SKIP_LIST} value. The following regular expressions are invalid: ${invalidRegularExpressions}`
      throw Error(errMessage)
    }
  }
  const fetchParameters = config?.value?.[FETCH]
  const fetchTargetParameters = config?.value?.[FETCH_TARGET]
  const skipListParameters = config?.value?.[SKIP_LIST] // support deprecated version
  const deployParams = config?.value?.[DEPLOY]
  const filePathsRegexSkipList = getFilePathRegexSkipList(config)
  const clientConfig = config?.value?.[CLIENT_CONFIG]
  if (clientConfig?.[FETCH_ALL_TYPES_AT_ONCE] && fetchTargetParameters !== undefined) {
    log.warn(`${FETCH_ALL_TYPES_AT_ONCE} is not supported with ${FETCH_TARGET}. Ignoring ${FETCH_ALL_TYPES_AT_ONCE}`)
    clientConfig[FETCH_ALL_TYPES_AT_ONCE] = false
  }
  if (filePathsRegexSkipList !== undefined) {
    validateRegularExpressions(filePathsRegexSkipList)
  }
  if (fetchTargetParameters !== undefined) {
    validateFetchParameters(convertToQueryParams(fetchTargetParameters))
  }

  if (skipListParameters !== undefined) {
    validateFetchParameters(convertToQueryParams(skipListParameters))
  }

  if (fetchParameters?.[INCLUDE] !== undefined) {
    validateFetchParameters(fetchParameters[INCLUDE])
  }

  if (fetchParameters?.[EXCLUDE] !== undefined) {
    validateFetchParameters(fetchParameters[EXCLUDE])
  }

  if (deployParams !== undefined) {
    validateDeployParams(deployParams)
  }

  if (clientConfig?.[INSTALLED_SUITEAPPS] !== undefined) {
    validateInstalledSuiteApps(clientConfig[INSTALLED_SUITEAPPS])
  }
}

const netsuiteConfigFromConfig = (config: Readonly<InstanceElement> | undefined):
  NetsuiteConfig => {
  try {
    validateConfig(config)

    const netsuiteConfig: { [K in keyof Required<NetsuiteConfig>]: NetsuiteConfig[K] } = {
      [TYPES_TO_SKIP]: config?.value?.[TYPES_TO_SKIP] && makeArray(config?.value?.[TYPES_TO_SKIP]),
      [DEPLOY]: config?.value?.[DEPLOY],
      [DEPLOY_REFERENCED_ELEMENTS]: config?.value?.[DEPLOY_REFERENCED_ELEMENTS],
      [CONCURRENCY_LIMIT]: config?.value?.[CONCURRENCY_LIMIT],
      [FILE_PATHS_REGEX_SKIP_LIST]: getFilePathRegexSkipList(config),
      [CLIENT_CONFIG]: config?.value?.[CLIENT_CONFIG],
      [SUITEAPP_CLIENT_CONFIG]: config?.value?.[SUITEAPP_CLIENT_CONFIG],
      [FETCH_TARGET]: config?.value?.[FETCH_TARGET],
      [SKIP_LIST]: config?.value?.[SKIP_LIST], // support deprecated version
      [USE_CHANGES_DETECTION]: config?.value?.[USE_CHANGES_DETECTION],
      [FETCH]: config?.value?.[FETCH],
      [LOCKED_ELEMENTS_TO_EXCLUDE]: config?.value?.[LOCKED_ELEMENTS_TO_EXCLUDE],
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
  ({
    accountId: toCredentialsAccountId(credentials.value.accountId),
    tokenId: credentials.value.tokenId,
    tokenSecret: credentials.value.tokenSecret,
    suiteAppTokenId: credentials.value.suiteAppTokenId === '' ? undefined : credentials.value.suiteAppTokenId,
    suiteAppTokenSecret: credentials.value.suiteAppTokenSecret === '' ? undefined : credentials.value.suiteAppTokenSecret,
  })

const getAdapterOperations = (context: AdapterOperationsContext): AdapterOperations => {
  const adapterConfig = netsuiteConfigFromConfig(context.config)
  const credentials = netsuiteCredentialsFromCredentials(context.credentials)

  const globalLimiter = new Bottleneck({
    maxConcurrent: adapterConfig.concurrencyLimit
      ?? Math.max(
        adapterConfig.client?.sdfConcurrencyLimit ?? DEFAULT_CONCURRENCY,
        adapterConfig.suiteAppClient?.suiteAppConcurrencyLimit ?? DEFAULT_CONCURRENCY
      ),
  })
  const suiteAppClient = credentials.suiteAppTokenId && credentials.suiteAppTokenSecret
    ? new SuiteAppClient({
      credentials: {
        accountId: credentials.accountId,
        suiteAppTokenId: credentials.suiteAppTokenId,
        suiteAppTokenSecret: credentials.suiteAppTokenSecret,
      },
      config: adapterConfig[SUITEAPP_CLIENT_CONFIG],
      globalLimiter,
    })
    : undefined

  const sdfClient = new SdfClient({
    credentials,
    config: adapterConfig[CLIENT_CONFIG],
    globalLimiter,
  })

  return new NetsuiteAdapter({
    client: new NetsuiteClient(sdfClient, suiteAppClient),
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
  install: async (): Promise<AdapterInstallResult> => {
    try {
      return await SdkDownloadService.download()
    } catch (err) {
      return { success: false, errors: [err.message ?? err] }
    }
  },
}
