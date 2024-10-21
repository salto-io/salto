/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  InstanceElement,
  Adapter,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
  ProgressReporter,
  DeployOptions,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { DeployResult } from '@salto-io/jsforce-types'
import { values } from '@salto-io/lowerdash'
import { inspectValue } from '@salto-io/adapter-utils'
import SalesforceClient, { validateCredentials } from './client/client'
import SalesforceAdapter from './adapter'
import {
  configType,
  usernamePasswordCredentialsType,
  oauthRequestParameters,
  isAccessTokenConfig,
  SalesforceConfig,
  accessTokenCredentialsType,
  UsernamePasswordCredentials,
  Credentials,
  OauthAccessTokenCredentials,
  CLIENT_CONFIG,
  SalesforceClientConfig,
  RetryStrategyName,
  FETCH_CONFIG,
  MAX_ITEMS_IN_RETRIEVE_REQUEST,
  ENUM_FIELD_PERMISSIONS,
  DEPLOY_CONFIG,
} from './types'
import { validateFetchParameters } from './fetch_profile/fetch_profile'
import { ConfigValidationError } from './config_validation'
import { updateDeprecatedConfiguration } from './deprecated_config'
import createChangeValidator, { changeValidators } from './change_validator'
import { getChangeGroupIds } from './group_changes'
import { ConfigChange } from './config_change'
import { configCreator } from './config_creator'
import { loadElementsFromFolder } from './sfdx_parser/sfdx_parser'
import { dumpElementsToFolder } from './sfdx_parser/sfdx_dump'
import { isProjectFolder, createProject } from './sfdx_parser/project'
import { getAdditionalReferences } from './additional_references'
import { getCustomReferences } from './custom_references/handlers'
import { dependencyChanger } from './dependency_changer'
import { METADATA_DEPLOY_PENDING_STATUS } from './constants'

type ValidatorsActivationConfig = deployment.changeValidators.ValidatorsActivationConfig

const log = logger(module)
const { isDefined } = values

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  if (isAccessTokenConfig(config)) {
    return new OauthAccessTokenCredentials({
      refreshToken: config.value.refreshToken,
      instanceUrl: config.value.instanceUrl,
      accessToken: config.value.accessToken,
      isSandbox: config.value.sandbox,
      clientId: config.value.clientId,
      clientSecret: config.value.clientSecret,
    })
  }
  return new UsernamePasswordCredentials({
    username: config.value.username,
    password: config.value.password,
    isSandbox: config.value.sandbox,
    apiToken: config.value.token,
  })
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): SalesforceConfig => {
  const validateClientConfig = (clientConfig: SalesforceClientConfig | undefined): void => {
    if (clientConfig?.maxConcurrentApiRequests !== undefined) {
      const invalidValues = Object.entries(clientConfig.maxConcurrentApiRequests).filter(
        ([_name, value]) => value === 0,
      )
      if (invalidValues.length > 0) {
        throw new ConfigValidationError(
          [CLIENT_CONFIG, 'maxConcurrentApiRequests'],
          `maxConcurrentApiRequests values cannot be set to 0. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`,
        )
      }
    }

    if (
      clientConfig?.retry?.retryStrategy !== undefined &&
      RetryStrategyName[clientConfig.retry.retryStrategy] === undefined
    ) {
      throw new ConfigValidationError(
        [CLIENT_CONFIG, 'clientConfig', 'retry', 'retryStrategy'],
        `retryStrategy value '${clientConfig.retry.retryStrategy}' is not supported`,
      )
    }
    if (clientConfig?.readMetadataChunkSize !== undefined) {
      const defaultValue = clientConfig?.readMetadataChunkSize.default
      if (defaultValue && (defaultValue < 1 || defaultValue > 10)) {
        throw new ConfigValidationError(
          [CLIENT_CONFIG, 'readMetadataChunkSize'],
          `readMetadataChunkSize default value should be between 1 to 10. current value is ${defaultValue}`,
        )
      }
      const overrides = clientConfig?.readMetadataChunkSize.overrides
      if (overrides) {
        const invalidValues = Object.entries(overrides).filter(([_name, value]) => value < 1 || value > 10)
        if (invalidValues.length > 0) {
          throw new ConfigValidationError(
            [CLIENT_CONFIG, 'readMetadataChunkSize'],
            `readMetadataChunkSize values should be between 1 to 10. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`,
          )
        }
      }
    }
    if (clientConfig?.deploy?.quickDeployParams !== undefined) {
      if (
        clientConfig.deploy.quickDeployParams.requestId === undefined ||
        clientConfig.deploy.quickDeployParams.hash === undefined
      ) {
        throw new ConfigValidationError(
          [CLIENT_CONFIG, 'deploy', 'quickDeployParams'],
          'quickDeployParams must include requestId and hash',
        )
      }
    }
  }

  const validateValidatorsConfig = (validators: ValidatorsActivationConfig | undefined): void => {
    if (validators !== undefined && !_.isPlainObject(validators)) {
      throw new ConfigValidationError(
        ['validators'],
        'Enabled validators configuration must be an object if it is defined',
      )
    }
    if (_.isPlainObject(validators)) {
      const validValidatorsNames = Object.keys(changeValidators)
      Object.entries(validators as {}).forEach(([key, value]) => {
        if (!validValidatorsNames.includes(key)) {
          throw new ConfigValidationError(
            ['validators', key],
            `Validator ${key} does not exist, expected one of ${validValidatorsNames.join(',')}`,
          )
        }
        if (!_.isBoolean(value)) {
          throw new ConfigValidationError(['validators', key], 'Value must be true or false')
        }
      })
    }
  }

  const validateEnumFieldPermissions = (enumFieldPermissions: boolean | undefined): void => {
    if (enumFieldPermissions !== undefined && !_.isBoolean(enumFieldPermissions)) {
      throw new ConfigValidationError(
        ['enumFieldPermissions'],
        'Enabled enumFieldPermissions configuration must be true or false if it is defined',
      )
    }
  }

  validateFetchParameters(config?.value?.[FETCH_CONFIG] ?? {}, [FETCH_CONFIG])

  validateClientConfig(config?.value?.client)

  validateValidatorsConfig(config?.value?.deploy?.changeValidators)

  validateEnumFieldPermissions(config?.value?.enumFieldPermissions)

  const adapterConfig: {
    [K in keyof Required<SalesforceConfig>]: SalesforceConfig[K]
  } = {
    fetch: config?.value?.[FETCH_CONFIG],
    maxItemsInRetrieveRequest: config?.value?.[MAX_ITEMS_IN_RETRIEVE_REQUEST],
    enumFieldPermissions: config?.value?.[ENUM_FIELD_PERMISSIONS],
    client: config?.value?.[CLIENT_CONFIG],
    deploy: config?.value?.[DEPLOY_CONFIG],
    fixElements: config?.value?.fixElements,
    customReferences: config?.value?.customReferences,
    // Deprecated and used for backwards compatibility (SALTO-4468)
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))

  return adapterConfig
}

export const createUrlFromUserInput = (value: Values): string => {
  const endpoint = value.sandbox ? 'test' : 'login'
  return `https://${endpoint}.salesforce.com/services/oauth2/authorize?response_type=token&client_id=${value.consumerKey}&scope=refresh_token%20full&redirect_uri=http://localhost:${value.port}&prompt=login%20consent`
}

const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => ({
  url: createUrlFromUserInput(userInput.value),
  oauthRequiredFields: ['refresh_token', 'instance_url', 'access_token'],
})

export const getConfigChange = (
  configFromFetch?: ConfigChange,
  configWithoutDeprecated?: ConfigChange,
): ConfigChange | undefined => {
  if (configWithoutDeprecated !== undefined && configFromFetch !== undefined) {
    return {
      config: configFromFetch.config,
      message: `${configWithoutDeprecated.message}
In Addition, ${configFromFetch.message}`,
    }
  }

  if (configWithoutDeprecated !== undefined) {
    return configWithoutDeprecated
  }

  return configFromFetch
}

export type DeployProgressReporter = ProgressReporter & {
  reportMetadataProgress: (args: { result: DeployResult; suffix?: string }) => void
  reportDataProgress: (successInstances: number) => void
}

export type SalesforceAdapterDeployOptions = DeployOptions & {
  progressReporter: DeployProgressReporter
}

export const createDeployProgressReporter = async (
  progressReporter: ProgressReporter,
  client: SalesforceClient,
): Promise<DeployProgressReporter> => {
  let deployResult: DeployResult | undefined
  let suffix: string | undefined
  let deployedDataInstances = 0
  const baseUrl = await client.getUrl()

  const linkToSalesforce = ({ id, checkOnly }: DeployResult): string => {
    if (!baseUrl) {
      return ''
    }
    const deploymentUrl = `${baseUrl}lightning/setup/DeployStatus/page?address=%2Fchangemgmt%2FmonitorDeploymentsDetails.apexp%3FasyncId%3D${id}`
    const deploymentOrValidation = checkOnly ? 'validation' : 'deployment'
    return ` View ${deploymentOrValidation} status [in Salesforce](${deploymentUrl})`
  }

  const reportProgress = (): void => {
    let metadataProgress: string | undefined
    let dataProgress: string | undefined
    if (deployResult) {
      metadataProgress =
        deployResult.status === METADATA_DEPLOY_PENDING_STATUS
          ? 'Metadata: Waiting on another deploy or automated process to finish in Salesforce'
          : `${deployResult.numberComponentsDeployed}/${deployResult.numberComponentsTotal} Metadata Components, ${deployResult.numberTestsCompleted}/${deployResult.numberTestsTotal} Tests.${linkToSalesforce(deployResult)}`
    }
    if (deployedDataInstances > 0) {
      dataProgress = `${deployedDataInstances} Data Instances`
    }
    if (metadataProgress || dataProgress) {
      const message = [dataProgress, metadataProgress, suffix].filter(isDefined).join(', ')
      log.trace('reported message is: %s for deploy result: %s', message, inspectValue(deployResult))
      progressReporter.reportProgress({ message })
    }
  }

  return {
    ...progressReporter,
    reportMetadataProgress: args => {
      deployResult = args.result
      suffix = args.suffix
      reportProgress()
    },
    reportDataProgress: successInstances => {
      deployedDataInstances += successInstances
      reportProgress()
    },
  }
}

export const adapter: Adapter = {
  operations: context => {
    const updatedConfig = context.config && updateDeprecatedConfiguration(context.config)
    const config = adapterConfigFromConfig(updatedConfig?.config ?? context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const client = new SalesforceClient({
      credentials,
      config: config[CLIENT_CONFIG],
    })
    let deployProgressReporterPromise: Promise<DeployProgressReporter> | undefined

    const createSalesforceAdapter = (): SalesforceAdapter => {
      const { elementsSource, getElemIdFunc } = context
      return new SalesforceAdapter({
        client,
        config,
        getElemIdFunc,
        elementsSource,
      })
    }

    return {
      fetch: async opts => {
        const salesforceAdapter = createSalesforceAdapter()
        const fetchResults = await salesforceAdapter.fetch(opts)
        fetchResults.updatedConfig = getConfigChange(
          fetchResults.updatedConfig,
          updatedConfig && {
            config: [updatedConfig.config],
            message: updatedConfig.message,
          },
        )
        return fetchResults
      },

      deploy: async opts => {
        const salesforceAdapter = createSalesforceAdapter()
        deployProgressReporterPromise =
          deployProgressReporterPromise ?? createDeployProgressReporter(opts.progressReporter, client)
        return salesforceAdapter.deploy({
          ...opts,
          progressReporter: await deployProgressReporterPromise,
        })
      },

      validate: async opts => {
        const salesforceAdapter = createSalesforceAdapter()
        deployProgressReporterPromise =
          deployProgressReporterPromise ?? createDeployProgressReporter(opts.progressReporter, client)
        return salesforceAdapter.validate({
          ...opts,
          progressReporter: await deployProgressReporterPromise,
        })
      },

      deployModifiers: {
        changeValidator: createChangeValidator({
          config,
          isSandbox: credentials.isSandbox,
          checkOnly: false,
          client,
        }),
        dependencyChanger,
        getChangeGroupIds,
      },

      validationModifiers: {
        changeValidator: createChangeValidator({
          config,
          isSandbox: credentials.isSandbox,
          checkOnly: true,
          client,
        }),
      },

      fixElements: async elements => {
        const salesforceAdapter = createSalesforceAdapter()
        return salesforceAdapter.fixElements(elements)
      },
    }
  },
  validateCredentials: async config => validateCredentials(credentialsFromConfig(config)),
  authenticationMethods: {
    basic: {
      credentialsType: usernamePasswordCredentialsType,
    },
    oauth: {
      createOAuthRequest,
      credentialsType: accessTokenCredentialsType,
      oauthRequestParameters,
      createFromOauthResponse: async (oldConfig: Values, response: OauthAccessTokenResponse) => ({
        sandbox: oldConfig.sandbox,
        clientId: oldConfig.consumerKey,
        clientSecret: oldConfig.consumerSecret,
        accessToken: response.fields.accessToken,
        instanceUrl: response.fields.instanceUrl,
        refreshToken: response.fields.refreshToken,
      }),
    },
  },
  configType,
  configCreator,
  adapterFormat: {
    isInitializedFolder: isProjectFolder,
    initFolder: createProject,
    loadElementsFromFolder,
    dumpElementsToFolder,
  },
  getAdditionalReferences,
  getCustomReferences,
}
