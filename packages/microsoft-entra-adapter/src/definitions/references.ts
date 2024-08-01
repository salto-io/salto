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
  definitions,
  references as referenceUtils,
  fetch as fetchUtils,
  createChangeElementResolver,
} from '@salto-io/adapter-components'
import { Change, InstanceElement } from '@salto-io/adapter-api'
import {
  ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME,
  APPLICATION_API_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  APP_ROLE_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_CONDITION_APPLICATIONS_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_CONDITION_LOCATIONS_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_CONDITION_USERS_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
  DIRECTORY_ROLE_MEMBERS_TYPE_NAME,
  DIRECTORY_ROLE_TEMPLATE_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  DOMAIN_NAME_REFERENCES_FIELD_NAME,
  DOMAIN_TYPE_NAME,
  GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
  GROUP_TYPE_NAME,
  LIFE_CYCLE_POLICY_TYPE_NAME,
  OAUTH2_PERMISSION_GRANT_TYPE_NAME,
  ODATA_TYPE_FIELD_NACL_CASE,
  PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME,
  ROLE_DEFINITION_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
  SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME,
} from '../constants'
import { ReferenceContextStrategies, Options, CustomReferenceSerializationStrategyName } from './types'

const { toNestedTypeName } = fetchUtils.element

const createMicrosoftAuthenticatorReferences = (): referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] => {
  const displayStateNames = ['App', 'Location']
  const targetNames = ['include', 'exclude']
  const featureSettingsTypeName = toNestedTypeName(AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, 'featureSettings')
  return displayStateNames.flatMap(displayStateName =>
    targetNames.map(targetName => ({
      src: {
        field: 'id',
        parentTypes: [
          toNestedTypeName(
            toNestedTypeName(featureSettingsTypeName, `display${displayStateName}InformationRequiredState`),
            `${targetName}Target`,
          ),
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
    src: { field: 'resourceId', parentTypes: [GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME, OAUTH2_PERMISSION_GRANT_TYPE_NAME] },
    target: { type: SERVICE_PRINCIPAL_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'clientId', parentTypes: [OAUTH2_PERMISSION_GRANT_TYPE_NAME] },
    target: { type: SERVICE_PRINCIPAL_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: DOMAIN_NAME_REFERENCES_FIELD_NAME, parentTypes: [DOMAIN_TYPE_NAME] },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'attributeSet', parentTypes: [CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME] },
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
    src: { field: 'id', parentTypes: [toNestedTypeName(ROLE_DEFINITION_TYPE_NAME, 'inheritsPermissionsFrom')] },
    target: { type: ROLE_DEFINITION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'roleTemplateId', parentTypes: [DIRECTORY_ROLE_TYPE_NAME] },
    target: { type: DIRECTORY_ROLE_TEMPLATE_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'appId',
      parentTypes: [
        SERVICE_PRINCIPAL_TYPE_NAME,
        AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
        toNestedTypeName(APPLICATION_API_TYPE_NAME, PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME),
      ],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'appId',
  },
  {
    src: { field: 'appRoleId', parentTypes: [GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME] },
    target: { type: APP_ROLE_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: GROUP_LIFE_CYCLE_POLICY_FIELD_NAME, parentTypes: [GROUP_TYPE_NAME] },
    target: { type: LIFE_CYCLE_POLICY_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'id',
      parentTypes: [toNestedTypeName(AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, 'excludeTargets')],
    },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'id',
      parentTypes: [toNestedTypeName(AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, 'includeTargets')],
    },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'includeLocations',
      parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_LOCATIONS_TYPE_NAME],
    },
    target: { type: CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'excludeLocations',
      parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_LOCATIONS_TYPE_NAME],
    },
    target: { type: CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'includeApplications',
      parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_APPLICATIONS_TYPE_NAME],
    },
    target: { type: SERVICE_PRINCIPAL_TYPE_NAME },
    serializationStrategy: 'appId',
  },
  {
    src: {
      field: 'excludeApplications',
      parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_APPLICATIONS_TYPE_NAME],
    },
    target: { type: SERVICE_PRINCIPAL_TYPE_NAME },
    serializationStrategy: 'appId',
  },
  {
    src: { field: 'includeRoles', parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_USERS_TYPE_NAME] },
    target: { type: ROLE_DEFINITION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'excludeRoles', parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_USERS_TYPE_NAME] },
    target: { type: ROLE_DEFINITION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'includeGroups', parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_USERS_TYPE_NAME] },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: { field: 'excludeGroups', parentTypes: [CONDITIONAL_ACCESS_POLICY_CONDITION_USERS_TYPE_NAME] },
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
  contextStrategyLookup: {
    ODataType: referenceUtils.neighborContextGetter({
      contextFieldName: ODATA_TYPE_FIELD_NACL_CASE,
      getLookUpName: async ({ ref }) => ref.elemID.name,
      contextValueMapper: refType => SUPPORTED_DIRECTORY_OBJECT_ODATA_TYPE_NAME_TO_TYPE_NAME[refType],
    }),
  },
}

const resolverCreator = referenceUtils.getResolverCreator<Options>({ references: REFERENCES })
export const changeResolver = createChangeElementResolver<Change<InstanceElement>>({
  getLookUpName: referenceUtils.generateLookupFunc(REFERENCE_RULES, resolverCreator),
})
