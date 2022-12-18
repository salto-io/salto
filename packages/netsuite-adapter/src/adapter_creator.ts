/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { SdkDownloadService } from '@salto-io/suitecloud-cli'
import Bottleneck from 'bottleneck'
import { CLIENT_CONFIG, CONFIG, configType, DEFAULT_CONCURRENCY, NetsuiteConfig, validateDeployParams, validateFetchConfig } from './config'
import { NETSUITE } from './constants'
import { validateFetchParameters, convertToQueryParams, validateNetsuiteQueryParameters, validateArrayOfStrings, validatePlainObject, FETCH_PARAMS } from './query'
import { Credentials, isSdfCredentialsOnly, isSuiteAppCredentials, toCredentialsAccountId } from './client/credentials'
import SuiteAppClient from './client/suiteapp_client/suiteapp_client'
import SdfClient from './client/sdf_client'
import NetsuiteClient from './client/client'
import NetsuiteAdapter from './adapter'

const log = logger(module)

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
        message: 'Salto SuiteApp Token ID (optional)',
      },
    },
    suiteAppTokenSecret: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Salto SuiteApp Token Secret (optional)',
      },
    },
    suiteAppActivationKey: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Salto SuiteApp Activation Key (optional)',
      },
    },
  },
  annotationRefsOrTypes: {},
  annotations: {},
})

const validateInstalledSuiteApps = (installedSuiteApps: unknown): void => {
  validateArrayOfStrings(installedSuiteApps, [CONFIG.client, CLIENT_CONFIG.installedSuiteApps])
  const invalidValues = installedSuiteApps.filter(id => !SUITEAPP_ID_FORMAT_REGEX.test(id))
  if (invalidValues.length !== 0) {
    throw new Error(`${CLIENT_CONFIG.installedSuiteApps} values should contain only lowercase characters or numbers and exactly two dots (such as com.saltoio.salto). The following values are invalid: ${invalidValues.join(', ')}`)
  }
}

const validateRegularExpressions = (regularExpressions: string[]): void => {
  const invalidRegularExpressions = regularExpressions
    .filter(strRegex => !regex.isValidRegex(strRegex))
  if (!_.isEmpty(invalidRegularExpressions)) {
    const errMessage = `received an invalid ${CONFIG.filePathRegexSkipList} value. The following regular expressions are invalid: ${invalidRegularExpressions}`
    throw new Error(errMessage)
  }
}

function validateConfig(config: Record<string, unknown>): asserts config is NetsuiteConfig {
  const {
    fetch,
    fetchTarget,
    skipList, // support deprecated version
    deploy,
    client,
    filePathRegexSkipList,
    typesToSkip,
  } = _.pick(config, Object.values(CONFIG))

  if (filePathRegexSkipList !== undefined) {
    validateArrayOfStrings(filePathRegexSkipList, CONFIG.filePathRegexSkipList)
    validateRegularExpressions(filePathRegexSkipList)
  }
  if (typesToSkip !== undefined) {
    validateArrayOfStrings(typesToSkip, CONFIG.typesToSkip)
  }

  if (client !== undefined) {
    validatePlainObject(client, CONFIG.client)
    const {
      fetchAllTypesAtOnce,
      installedSuiteApps,
    } = _.pick(client, Object.values(CLIENT_CONFIG))

    if (fetchAllTypesAtOnce && fetchTarget !== undefined) {
      log.warn(`${CLIENT_CONFIG.fetchAllTypesAtOnce} is not supported with ${CONFIG.fetchTarget}. Ignoring ${CLIENT_CONFIG.fetchAllTypesAtOnce}`)
      client[CLIENT_CONFIG.fetchAllTypesAtOnce] = false
    }
    if (installedSuiteApps !== undefined) {
      validateInstalledSuiteApps(installedSuiteApps)
    }
  }

  if (fetchTarget !== undefined) {
    validatePlainObject(fetchTarget, CONFIG.fetchTarget)
    validateNetsuiteQueryParameters(fetchTarget, CONFIG.fetchTarget)
    validateFetchParameters(convertToQueryParams(fetchTarget))
  }

  if (skipList !== undefined) {
    validatePlainObject(skipList, CONFIG.skipList)
    validateNetsuiteQueryParameters(skipList, CONFIG.skipList)
    validateFetchParameters(convertToQueryParams(skipList))
  }

  if (fetch !== undefined) {
    validatePlainObject(fetch, CONFIG.fetch)
    validateFetchConfig(fetch)
  }

  if (deploy !== undefined) {
    validatePlainObject(deploy, CONFIG.deploy)
    validateDeployParams(deploy)
  }
}

const netsuiteConfigFromConfig = (
  configInstance: Readonly<InstanceElement> | undefined
): NetsuiteConfig => {
  try {
    if (!configInstance) {
      return {}
    }
    const { value: config } = configInstance
    validateConfig(config)
    log.debug('using netsuite adapter config: %o', {
      ...config,
      fetch: _.omit(config.fetch, FETCH_PARAMS.lockedElementsToExclude),
    })
    return _.pickBy(config, (_value, key) => {
      if (key in CONFIG) {
        return true
      }
      log.debug('Unknown config property was found: %s', key)
      return false
    })
  } catch (e) {
    e.message = `Failed to load Netsuite config: ${e.message}`
    log.error(e.message)
    throw e
  }
}

const throwOnMissingSuiteAppLoginCreds = (credentials: Credentials): void => {
  if (isSdfCredentialsOnly(credentials)) {
    return
  }
  // suiteAppActivationKey may be undefined but empty string is forbidden
  if (isSuiteAppCredentials(credentials) && credentials.suiteAppActivationKey !== '') {
    return
  }
  const undefinedBaseCreds = [
    { key: 'suiteAppTokenId', value: credentials.suiteAppTokenId },
    { key: 'suiteAppTokenSecret', value: credentials.suiteAppTokenSecret },
  ].filter(item => !item.value).map(item => item.key)
  const undefinedCreds = undefinedBaseCreds.concat(credentials.suiteAppActivationKey === '' ? ['suiteAppActivationKey'] : [])
  throw new Error(`Missing SuiteApp login creds: ${undefinedCreds.join(', ')}. Please login again.`)
}

const netsuiteCredentialsFromCredentials = (
  credsInstance: Readonly<InstanceElement>
): Credentials => {
  const throwOnInvalidAccountId = (credentials: Credentials): void => {
    const isValidAccountIdFormat = /^[A-Za-z0-9_\\-]+$/.test(credentials.accountId)
    if (!isValidAccountIdFormat) {
      throw new Error(`received an invalid accountId value: (${credsInstance.value.accountId}). The accountId must be composed only from alphanumeric, '_' and '-' characters`)
    }
  }

  const credentials = {
    accountId: toCredentialsAccountId(credsInstance.value.accountId),
    tokenId: credsInstance.value.tokenId,
    tokenSecret: credsInstance.value.tokenSecret,
    suiteAppTokenId: credsInstance.value.suiteAppTokenId === '' ? undefined : credsInstance.value.suiteAppTokenId,
    suiteAppTokenSecret: credsInstance.value.suiteAppTokenSecret === '' ? undefined : credsInstance.value.suiteAppTokenSecret,
    suiteAppActivationKey: credsInstance.value.suiteAppActivationKey,
  }
  throwOnInvalidAccountId(credentials)
  throwOnMissingSuiteAppLoginCreds(credentials)
  return credentials
}

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

  const suiteAppClient = isSuiteAppCredentials(credentials) && credentials.suiteAppActivationKey
    ? new SuiteAppClient({
      credentials,
      config: adapterConfig.suiteAppClient,
      globalLimiter,
    })
    : undefined

  const sdfClient = new SdfClient({
    credentials,
    config: adapterConfig.client,
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
