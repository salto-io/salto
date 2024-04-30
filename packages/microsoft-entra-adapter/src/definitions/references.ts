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
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import {
  APPLICATION_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  GROUP_LIFE_CYCLE_POLICY_TYPE_NAME,
  GROUP_TYPE_NAME,
  LIFE_CYCLE_POLICY_TYPE_NAME,
  ROLE_DEFINITION_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
} from '../constants'
import { ReferenceContextStrategies, Options, CustomReferenceSerializationStrategyName } from './types'

const createMicrosoftAuthenticatorReferences = (): referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] => {
  const displayStateNames = ['App', 'Location']
  const targetNames = ['include', 'exclude']
  return displayStateNames.flatMap(displayStateName =>
    targetNames.map(targetName => ({
      src: {
        field: 'id',
        parentTypes: [
          `${AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME}__featureSettings__display${displayStateName}InformationRequiredState__${targetName}Target`,
        ],
      },
      target: { type: GROUP_TYPE_NAME },
      serializationStrategy: 'id',
    })),
  )
}

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  ...createMicrosoftAuthenticatorReferences(),
  {
    src: { field: 'templateId', parentTypes: [ROLE_DEFINITION_TYPE_NAME] },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'appId', parentTypes: [SERVICE_PRINCIPAL_TYPE_NAME, AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME] },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'appId',
  },
  {
    src: { field: 'resourceId' },
    target: { type: SERVICE_PRINCIPAL_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'id', parentTypes: [GROUP_LIFE_CYCLE_POLICY_TYPE_NAME] },
    target: { type: LIFE_CYCLE_POLICY_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'id', parentTypes: [`${AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME}__excludeTargets`] },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'id', parentTypes: [`${AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME}__includeTargets`] },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  fieldsToGroupBy: ['id', 'name', 'appId'],
  serializationStrategyLookup: {
    appId: {
      serialize: ({ ref }) => ref.value.value.appId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'appId',
    },
  },
}
