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
import {
  Adapter,
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  AdapterInstallResult,
  AdapterOperationsContext,
  AdapterOperations,
} from '@salto-io/adapter-api'
import { SdkDownloadService } from '@salto-io/suitecloud-cli'
import Bottleneck from 'bottleneck'
import { DEFAULT_CONCURRENCY } from './config/constants'
import { configType } from './config/types'
import { netsuiteConfigFromConfig, instanceLimiterCreator } from './config/config_creator'
import { NETSUITE } from './constants'
import { Credentials, isSdfCredentialsOnly, isSuiteAppCredentials, toCredentialsAccountId } from './client/credentials'
import SuiteAppClient from './client/suiteapp_client/suiteapp_client'
import SdfClient from './client/sdf_client'
import NetsuiteClient from './client/client'
import NetsuiteAdapter from './adapter'
import loadElementsFromFolder from './sdf_folder_loader'

const configID = new ElemID(NETSUITE)

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
  ]
    .filter(item => !item.value)
    .map(item => item.key)
  const undefinedCreds = undefinedBaseCreds.concat(
    credentials.suiteAppActivationKey === '' ? ['suiteAppActivationKey'] : [],
  )
  throw new Error(`Missing SuiteApp login creds: ${undefinedCreds.join(', ')}. Please login again.`)
}

const netsuiteCredentialsFromCredentials = (credsInstance: Readonly<InstanceElement>): Credentials => {
  const throwOnInvalidAccountId = (credentials: Credentials): void => {
    const isValidAccountIdFormat = /^[A-Za-z0-9_\\-]+$/.test(credentials.accountId)
    if (!isValidAccountIdFormat) {
      throw new Error(
        `received an invalid accountId value: (${credsInstance.value.accountId}). The accountId must be composed only from alphanumeric, '_' and '-' characters`,
      )
    }
  }

  const credentials = {
    accountId: toCredentialsAccountId(credsInstance.value.accountId),
    tokenId: credsInstance.value.tokenId,
    tokenSecret: credsInstance.value.tokenSecret,
    suiteAppTokenId: credsInstance.value.suiteAppTokenId === '' ? undefined : credsInstance.value.suiteAppTokenId,
    suiteAppTokenSecret:
      credsInstance.value.suiteAppTokenSecret === '' ? undefined : credsInstance.value.suiteAppTokenSecret,
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
    maxConcurrent:
      adapterConfig.concurrencyLimit ??
      Math.max(
        adapterConfig.client?.sdfConcurrencyLimit ?? DEFAULT_CONCURRENCY,
        adapterConfig.suiteAppClient?.suiteAppConcurrencyLimit ?? DEFAULT_CONCURRENCY,
      ) + 1,
  })

  const instanceLimiter = instanceLimiterCreator(adapterConfig.client)

  const suiteAppClient =
    isSuiteAppCredentials(credentials) && credentials.suiteAppActivationKey
      ? new SuiteAppClient({
          credentials,
          config: adapterConfig.suiteAppClient,
          globalLimiter,
          instanceLimiter,
        })
      : undefined

  const sdfClient = new SdfClient({
    credentials,
    config: adapterConfig.client,
    globalLimiter,
    instanceLimiter,
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
  loadElementsFromFolder,
}
