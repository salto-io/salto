/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements, definitions } from '@salto-io/adapter-components'
import { BuiltinTypes, ListType, MapType } from '@salto-io/adapter-api'
import { WORKATO } from './constants'

export const ENABLE_DEPLOY_SUPPORT_FLAG = 'enableDeploySupport'

type WorkatoFetchConfig = definitions.UserFetchConfig<{
  customNameMappingOptions: never
  fetchCriteria: definitions.DefaultFetchCriteria
}> & {
  serviceConnectionNames?: Record<string, string[]>
}

type WorkatoClientConfig = definitions.ClientBaseConfig<definitions.ClientRateLimitConfig>

export type WorkatoUserConfig = definitions.UserConfig<
  never,
  WorkatoClientConfig,
  WorkatoFetchConfig,
  definitions.UserDeployConfig
> & {
  [ENABLE_DEPLOY_SUPPORT_FLAG]?: boolean
}

const changeValidatorNames = [
  'deployTypesNotSupported',
  'notSupportedTypes',
  'notSupportedRemoval',
  'notSupportedRecipeSettings',
  'deployNotSupported',
] as const

export type ChangeValidatorName = (typeof changeValidatorNames)[number]

export type ChangeValidatorsDeploySupportedName =
  | 'deployTypesNotSupported'
  | 'notSupportedTypes'
  | 'notSupportedRemoval'
  | 'notSupportedRecipeSettings'

export const DEFAULT_CONFIG: WorkatoUserConfig = {
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
  },
}

export const configType = definitions.createUserConfigType({
  adapterName: WORKATO,
  defaultConfig: DEFAULT_CONFIG,
  additionalFields: { [ENABLE_DEPLOY_SUPPORT_FLAG]: { refType: BuiltinTypes.BOOLEAN } },
  additionalFetchFields: {
    serviceConnectionNames: { refType: new MapType(new ListType(BuiltinTypes.STRING)) },
  },
  changeValidatorNames: [...changeValidatorNames],
  omitElemID: false,
  pathsToOmitFromDefaultConfig: [ENABLE_DEPLOY_SUPPORT_FLAG],
})
