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
import { FieldDefinition, ObjectType, ElemID, CORE_ANNOTATIONS, BuiltinTypes } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ValidatorsActivationConfig } from '../../deployment/change_validators'

export type UserDeployConfig = {
  changeValidators?: ValidatorsActivationConfig
}

export const createChangeValidatorConfigType = <ChangeValidatorName extends string>({
  adapterName,
  changeValidatorNames,
}: {
  adapterName: string
  changeValidatorNames: ChangeValidatorName[]
}): ObjectType =>
  createMatchingObjectType<Partial<Record<string, boolean>>>({
    elemID: new ElemID(adapterName, 'changeValidatorConfig'),
    fields: Object.fromEntries(
      changeValidatorNames.map(validatorName => [validatorName, { refType: BuiltinTypes.BOOLEAN }]),
    ),
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

export const createUserDeployConfigType = (
  adapter: string,
  changeValidatorsType: ObjectType,
  additionalFields?: Record<string, FieldDefinition>,
): ObjectType =>
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
  userValidationFunc: (userValue: string) => boolean,
): void => {
  const { defaultMissingUserFallback } = defaultMissingUserFallbackConfig
  if (defaultMissingUserFallback !== undefined && defaultMissingUserFallback !== DEPLOYER_FALLBACK_VALUE) {
    const isValidUserValue = userValidationFunc(defaultMissingUserFallback)
    if (!isValidUserValue) {
      throw Error(
        `Invalid user value in ${deployConfigPath}.defaultMissingUserFallback: ${defaultMissingUserFallback}. Value can be either ${DEPLOYER_FALLBACK_VALUE} or a valid user name`,
      )
    }
  }
}
