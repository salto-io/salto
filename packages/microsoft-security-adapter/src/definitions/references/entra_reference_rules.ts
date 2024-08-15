/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { references as referenceUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { entraConstants } from '../../constants'
import { ReferenceContextStrategies, CustomReferenceSerializationStrategyName } from '../types'
import { SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME } from '../../constants/entra'

const { recursiveNestedTypeName } = fetchUtils.element

const {
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
  PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME,
  ROLE_DEFINITION_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
} = entraConstants

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
          recursiveNestedTypeName(
            AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
            'featureSettings',
            `display${displayStateName}InformationRequiredState`,
            `${targetName}Target`,
          ),
        ],
      },
      target: { type: GROUP_TYPE_NAME },
      serializationStrategy: 'id',
    })),
  )
}

export const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  ...createMicrosoftAuthenticatorReferences(),
  {
    src: {
      field: 'resourceId',
      parentTypes: [
        GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
        SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
        OAUTH2_PERMISSION_GRANT_TYPE_NAME,
      ],
    },
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
    src: { field: 'id', parentTypes: [recursiveNestedTypeName(ROLE_DEFINITION_TYPE_NAME, 'inheritsPermissionsFrom')] },
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
        recursiveNestedTypeName(APPLICATION_API_TYPE_NAME, PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME),
      ],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'appId',
  },
  {
    src: {
      field: 'appRoleId',
      parentTypes: [GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME, SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME],
    },
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
      parentTypes: [recursiveNestedTypeName(AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, 'excludeTargets')],
    },
    target: { type: GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'id',
      parentTypes: [recursiveNestedTypeName(AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME, 'includeTargets')],
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
