/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements, definitions } from '@salto-io/adapter-components'
import { FieldDefinition } from '@salto-io/adapter-api'
import {
  ASSIGNMENT_FIELDS_STRATEGY_CONFIG_FIELD_NAME,
  AssignmentFieldsConfig,
  assignmentFieldsConfigType,
} from './assignment_fields'

type UserFetchConfig = definitions.UserFetchConfig<{
  customNameMappingOptions: never
  fetchCriteria: definitions.DefaultFetchCriteria
}>

type DeployConfigFieldsNames = typeof ASSIGNMENT_FIELDS_STRATEGY_CONFIG_FIELD_NAME
export type AdditionalDeployConfigFields = {
  [ASSIGNMENT_FIELDS_STRATEGY_CONFIG_FIELD_NAME]?: AssignmentFieldsConfig
}
export const additionalDeployConfigFieldsType: Record<DeployConfigFieldsNames, FieldDefinition> = {
  assignmentFieldsStrategy: {
    refType: assignmentFieldsConfigType,
  },
}
type UserDeployConfig = definitions.UserDeployConfig & AdditionalDeployConfigFields

export type UserConfig = definitions.UserConfig<
  never,
  definitions.ClientBaseConfig<definitions.ClientRateLimitConfig>,
  UserFetchConfig,
  UserDeployConfig
>

export const DEFAULT_CONFIG: UserConfig = {
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
  },
}
