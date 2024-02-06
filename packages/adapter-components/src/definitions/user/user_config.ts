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
import { FieldDefinition, ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, Field, ListType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ValidatorsActivationConfig } from '../../deployment/change_validators'

export type DefaultFetchCriteria = {
  name?: string
}

type FetchEntry<T extends Record<string, unknown> | undefined> = {
  type: string
  criteria?: T
}

export type UserFetchConfig<T extends Record<string, unknown> | undefined = DefaultFetchCriteria> = {
  include: FetchEntry<T>[]
  exclude: FetchEntry<T>[]
  hideTypes?: boolean
  // TODO deprecate and remove once the migration is complete and everything is async
  asyncPagination?: boolean
}

export type UserDeployConfig = {
  changeValidators?: ValidatorsActivationConfig
}

export const createUserFetchConfigType = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
  fetchCriteriaType?: ObjectType,
): ObjectType => {
  const defaultFetchCriteriaType = createMatchingObjectType<DefaultFetchCriteria>({
    elemID: new ElemID(adapter, 'FetchFilters'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  const fetchEntryType = createMatchingObjectType<FetchEntry<DefaultFetchCriteria>>({
    elemID: new ElemID(adapter, 'FetchEntry'),
    fields: {
      type: {
        refType: BuiltinTypes.STRING,
        annotations: { _required: true },
      },
      criteria: {
        refType: defaultFetchCriteriaType,
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  if (fetchCriteriaType !== undefined) {
    fetchEntryType.fields.criteria = new Field(fetchEntryType, 'criteria', fetchCriteriaType)
  }

  return createMatchingObjectType<UserFetchConfig>({
    elemID: new ElemID(adapter, 'userFetchConfig'),
    fields: {
      include: {
        refType: new ListType(fetchEntryType),
        annotations: { _required: true },
      },
      exclude: {
        refType: new ListType(fetchEntryType),
        annotations: { _required: true },
      },
      hideTypes: { refType: BuiltinTypes.BOOLEAN },
      asyncPagination: { refType: BuiltinTypes.BOOLEAN },
      ...additionalFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
}

export const createUserDeployConfigType = (
  adapter: string,
  changeValidatorsType: ObjectType,
  additionalFields?: Record<string, FieldDefinition>,
): ObjectType => (
  createMatchingObjectType<UserDeployConfig>({
    elemID: new ElemID(adapter, 'userDeployConfig'),
    fields: {
      // Record<string, boolean> type check doesn't pass for refType of ObjectType
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      changeValidators: { refType: changeValidatorsType },
      ...additionalFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
)

export const DEPLOYER_FALLBACK_VALUE = '##DEPLOYER##'

export type DefaultMissingUserFallbackConfig = {
  // Replace references for missing users during deploy with defaultMissingUserFallback value
  defaultMissingUserFallback?: string
}

/**
 * Verify defaultMissingUserFallback value in deployConfig is valid
 */
export const validateDefaultMissingUserFallbackConfig = (
  deployConfigPath: string,
  defaultMissingUserFallbackConfig: DefaultMissingUserFallbackConfig,
  userValidationFunc: (userValue: string) => boolean
): void => {
  const { defaultMissingUserFallback } = defaultMissingUserFallbackConfig
  if (defaultMissingUserFallback !== undefined && defaultMissingUserFallback !== DEPLOYER_FALLBACK_VALUE) {
    const isValidUserValue = userValidationFunc(defaultMissingUserFallback)
    if (!isValidUserValue) {
      throw Error(`Invalid user value in ${deployConfigPath}.defaultMissingUserFallback: ${defaultMissingUserFallback}. Value can be either ${DEPLOYER_FALLBACK_VALUE} or a valid user name`)
    }
  }
}
