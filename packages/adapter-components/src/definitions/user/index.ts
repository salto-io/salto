/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

export {
  UserConfig,
  createUserConfigType,
  ConfigTypeCreator,
  mergeWithDefaultConfig,
  adapterConfigFromConfig,
} from './user_config'
export { updateDeprecatedConfig, updateElemIDDefinitions } from './config_upgrade_utils'
export {
  UserFetchConfig,
  createUserFetchConfigType,
  ElemIDCustomization,
  DefaultFetchCriteria,
  UserFetchConfigOptions,
  FetchEntry,
} from './fetch_config'
export {
  UserDeployConfig,
  createUserDeployConfigType,
  validateDefaultMissingUserFallbackConfig,
  DefaultMissingUserFallbackConfig,
  DEPLOYER_FALLBACK_VALUE,
} from './deploy_config'
export {
  ClientBaseConfig,
  ClientRateLimitConfig,
  ClientRetryConfig,
  ClientPageSizeConfig,
  ClientTimeoutConfig,
  createClientConfigType,
  validateClientConfig,
} from './client_config'
export { getUpdatedConfigFromConfigChanges, ConfigChangeSuggestion } from './config_change'
