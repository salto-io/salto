/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
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
import { SdkDownloadService as NewSdkDownloadService } from '@salto-io/suitecloud-cli-new'
import { combineCustomReferenceGetters } from '@salto-io/adapter-components'
import _ from 'lodash'
import Bottleneck from 'bottleneck'
import { DEFAULT_CONCURRENCY } from './config/constants'
import { configType } from './config/types'
import { netsuiteConfigFromConfig, instanceLimiterCreator } from './config/config_creator'
import { NETSUITE } from './constants'
import {
  Credentials,
  isSdfCredentialsOnly,
  isSuiteAppCredentials,
  SdfOAuthCredentials,
  SdfTokenBasedCredentials,
  SuiteAppCredentials,
  toCredentialsAccountId,
} from './client/credentials'
import SuiteAppClient from './client/suiteapp_client/suiteapp_client'
import SdfClient from './client/sdf_client'
import NetsuiteClient from './client/client'
import NetsuiteAdapter from './adapter'
import loadElementsFromFolder from './sdf_folder_loader'
import { customReferenceHandlers } from './custom_references'

const log = logger(module)

type AllCredentials = SdfTokenBasedCredentials & SdfOAuthCredentials & SuiteAppCredentials

const configID = new ElemID(NETSUITE)

// The SuiteApp fields are commented out until we will be ready to expose them to the user
const defaultCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accountId: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Account ID' },
    },
    tokenId: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'SDF Token ID (for TBA)' },
    },
    tokenSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'SDF Token Secret (for TBA)' },
    },
    certificateId: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'SDF Certificate ID (for OAuth 2.0)' },
    },
    privateKey: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'SDF Private Key (for OAuth 2.0)' },
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

const throwOnInvalidAccountId = (credentials: Credentials): void => {
  const isValidAccountIdFormat = /^[A-Za-z0-9_\\-]+$/.test(credentials.accountId)
  if (!isValidAccountIdFormat) {
    throw new Error(
      `received an invalid accountId value: (${credentials.accountId}). The accountId must be composed only from alphanumeric, '_' and '-' characters`,
    )
  }
}

const throwOnSdfCredentialsMismatch = (credentials: AllCredentials): void => {
  if (credentials.tokenId !== undefined && credentials.certificateId !== undefined) {
    throw new Error('Expected to have one of tokenId and certificateId, but received both')
  }
  if (credentials.tokenId === undefined && credentials.certificateId === undefined) {
    throw new Error('Expected to have one of tokenId and certificateId, but received none')
  }
  if (credentials.tokenId !== undefined && credentials.tokenSecret === undefined) {
    throw new Error('Expected to have tokenSecret when tokenId is specified, but received none')
  }
  if (credentials.certificateId !== undefined && credentials.privateKey === undefined) {
    throw new Error('Expected to have privateKey when certificateId is specified, but received none')
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
  ]
    .filter(item => !item.value)
    .map(item => item.key)
  const undefinedCreds = undefinedBaseCreds.concat(
    credentials.suiteAppActivationKey === '' ? ['suiteAppActivationKey'] : [],
  )
  throw new Error(`Missing SuiteApp login creds: ${undefinedCreds.join(', ')}. Please login again.`)
}

const netsuiteCredentialsFromCredentials = (credsInstance: Readonly<InstanceElement>): Credentials => {
  const credentials: AllCredentials = {
    accountId: toCredentialsAccountId(credsInstance.value.accountId),
    tokenId: credsInstance.value.tokenId === '' ? undefined : credsInstance.value.tokenId,
    tokenSecret: credsInstance.value.tokenSecret === '' ? undefined : credsInstance.value.tokenSecret,
    certificateId: credsInstance.value.certificateId === '' ? undefined : credsInstance.value.certificateId,
    privateKey: credsInstance.value.privateKey === '' ? undefined : credsInstance.value.privateKey,
    suiteAppTokenId: credsInstance.value.suiteAppTokenId === '' ? undefined : credsInstance.value.suiteAppTokenId,
    suiteAppTokenSecret:
      credsInstance.value.suiteAppTokenSecret === '' ? undefined : credsInstance.value.suiteAppTokenSecret,
    suiteAppActivationKey: credsInstance.value.suiteAppActivationKey,
  }
  throwOnInvalidAccountId(credentials)
  throwOnSdfCredentialsMismatch(credentials)
  throwOnMissingSuiteAppLoginCreds(credentials)
  return credentials
}

const getAdapterOperations = (context: AdapterOperationsContext): AdapterOperations => {
  const { config: adapterConfig, originalConfig } = netsuiteConfigFromConfig(context.config)
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
    originalConfig,
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
      const newResult = await NewSdkDownloadService.download()
      log.info('New SDF installation result: %o', newResult)
      if (!newResult.success) {
        return newResult
      }
      const installedVersions = [newResult.installedVersion]
      return { ...newResult, installedVersions }
    } catch (err) {
      return { success: false, errors: [err.message ?? err] }
    }
  },
  adapterFormat: {
    loadElementsFromFolder,
  },
  getCustomReferences: combineCustomReferenceGetters(
    _.mapValues(customReferenceHandlers, handler => handler.findWeakReferences),
  ),
}
