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
  ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
  DIRECTORY_ROLE_MEMBERS_TYPE_NAME,
  DIRECTORY_ROLE_TEMPLATE_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  DOMAIN_NAME_REFERENCES_FIELD_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
  GROUP_TYPE_NAME,
  LIFE_CYCLE_POLICY_TYPE_NAME,
  ODATA_TYPE_FIELD_NACL_CASE,
  ROLE_DEFINITION_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
  SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME,
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
    src: { field: 'resourceId' },
    target: { type: SERVICE_PRINCIPAL_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'clientId' },
    target: { type: SERVICE_PRINCIPAL_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: DOMAIN_NAME_REFERENCES_FIELD_NAME },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'attributeSet' },
    target: { type: CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'id', parentTypes: [ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME] },
    target: { typeContext: 'ODataType' },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'id', parentTypes: [DIRECTORY_ROLE_MEMBERS_TYPE_NAME] },
    target: { typeContext: 'ODataType' },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'id', parentTypes: [`${ROLE_DEFINITION_TYPE_NAME}__inheritsPermissionsFrom`] },
    target: { type: ROLE_DEFINITION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'roleTemplateId', parentTypes: [DIRECTORY_ROLE_TYPE_NAME] },
    target: { type: DIRECTORY_ROLE_TEMPLATE_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'appId', parentTypes: [SERVICE_PRINCIPAL_TYPE_NAME, AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME] },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'appId',
  },
  {
    src: { field: GROUP_LIFE_CYCLE_POLICY_FIELD_NAME },
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
  {
    src: { field: 'includeLocations', parentTypes: [`${CONDITIONAL_ACCESS_POLICY_TYPE_NAME}__conditions__locations`] },
    target: { type: CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'excludeLocations', parentTypes: [`${CONDITIONAL_ACCESS_POLICY_TYPE_NAME}__conditions__locations`] },
    target: { type: CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME },
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
  contextStrategyLookup: {
    ODataType: referenceUtils.neighborContextGetter({
      contextFieldName: ODATA_TYPE_FIELD_NACL_CASE,
      getLookUpName: async ({ ref }) => ref.elemID.name,
      contextValueMapper: refType => SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME[refType],
    }),
  },
}
