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
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { UserFetchConfig } from '../../config'
import { Options } from '../types'
import {
  SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
  DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME,
  GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  OAUTH2_PERMISSION_GRANT_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  GROUP_TYPE_NAME,
  APP_ROLE_ASSIGNMENT_FIELD_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
  GROUP_LIFE_CYCLE_POLICY_TYPE_NAME,
  LIFE_CYCLE_POLICY_TYPE_NAME,
  GROUP_ADDITIONAL_DATA_FIELD_NAME,
  GROUP_ADDITIONAL_DATA_TYPE_NAME,
  ROLE_DEFINITION_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME,
  AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  APP_ROLES_FIELD_NAME,
  AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
  ADMINISTRATIVE_UNIT_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  DIRECTORY_ROLE_TEMPLATE_TYPE_NAME,
  DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME,
  DOMAIN_NAME_REFERENCES_FIELD_NAME,
  DOMAIN_NAME_REFERENCE_TYPE_NAME,
  DOMAIN_TYPE_NAME,
  PERMISSION_GRANT_POLICY_TYPE_NAME,
  CROSS_TENANT_ACCESS_POLICY_TYPE_NAME,
} from '../../constants'
import { GRAPH_BETA_PATH, GRAPH_V1_PATH } from '../requests/clients'
import { FetchCustomizations } from './types'
import {
  DEFAULT_FIELD_CUSTOMIZATIONS,
  DEFAULT_ID_PARTS,
  DEFAULT_TRANSFORMATION,
  ID_FIELD_TO_HIDE,
  NAME_ID_FIELD,
} from './constants'
import {
  adjustEntitiesWithExpandedMembers,
  createCustomizationsWithBasePathForFetch,
  createDefinitionForAppRoleAssignment,
} from './utils'

const graphV1Customizations: FetchCustomizations = {
  [GROUP_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/groups',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
      mergeAndTransform: {
        adjust: ({ value }) => {
          validatePlainObject(value, 'group')

          return {
            value: {
              ..._.omit(value, GROUP_ADDITIONAL_DATA_FIELD_NAME),
              // This is a workaround to retrieve the additional data from each group call, and then spread it into the group
              ..._.get(value, GROUP_ADDITIONAL_DATA_FIELD_NAME, [])[0],
              // lifeCyclePolicy is a singleton
              [GROUP_LIFE_CYCLE_POLICY_FIELD_NAME]: _.get(
                _.get(value, GROUP_LIFE_CYCLE_POLICY_FIELD_NAME, [])[0],
                'id',
              ),
            },
          }
        },
      },
      recurseInto: {
        [GROUP_ADDITIONAL_DATA_FIELD_NAME]: {
          typeName: GROUP_ADDITIONAL_DATA_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        [APP_ROLE_ASSIGNMENT_FIELD_NAME]: {
          typeName: GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        [GROUP_LIFE_CYCLE_POLICY_FIELD_NAME]: {
          typeName: GROUP_LIFE_CYCLE_POLICY_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [APP_ROLE_ASSIGNMENT_FIELD_NAME]: {
          standalone: {
            typeName: GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
            nestPathUnderParent: true,
            referenceFromParent: false,
          },
        },
      },
    },
  },
  [GROUP_ADDITIONAL_DATA_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/groups/{id}',
          queryArgs: {
            $select: 'assignedLabels,assignedLicenses,licenseProcessingState',
          },
        },
        transformation: {
          omit: ['id'],
        },
      },
    ],
    resource: {
      directFetch: false,
    },
  },
  [GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME]: createDefinitionForAppRoleAssignment('groups'),
  [LIFE_CYCLE_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/groupLifecyclePolicies',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  // We directly fetch the groupLifeCyclePolicies in another call. However, we also fetch it here per group to be able to reference it.
  // TODO SALTO-6072: investigate if we can receive all these references in a single call
  [GROUP_LIFE_CYCLE_POLICY_TYPE_NAME]: {
    resource: {
      directFetch: false,
      context: {
        dependsOn: {
          [LIFE_CYCLE_POLICY_TYPE_NAME]: {
            parentTypeName: LIFE_CYCLE_POLICY_TYPE_NAME,
            transformation: {
              pick: ['managedGroupTypes'],
            },
          },
        },
        // TODO SALTO-6077: we currently overlook this definition. We should validate this definition after fixing the issue
        conditions: [
          {
            fromContext: LIFE_CYCLE_POLICY_TYPE_NAME,
            match: ['Selected'],
          },
        ],
      },
    },
    requests: [
      {
        endpoint: {
          path: '/groups/{id}/groupLifecyclePolicies',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          pick: ['id'],
        },
      },
    ],
  },
  [APPLICATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/applications',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        appId: {
          hide: true,
        },
        [APP_ROLES_FIELD_NAME]: {
          sort: {
            properties: [{ path: 'displayName' }],
          },
        },
      },
    },
  },
  [SERVICE_PRINCIPAL_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/servicePrincipals',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: [
            // These fields are shared with the application, which we have a reference to
            'appDescription',
            'appDisplayName',
            'applicationTemplateId',
            'appRoles',
            'customSecurityAttributes',
            'disabledByMicrosoftStatus',
            'homepage',
            'info',
            'oauth2PermissionScopes',
            'passwordCredentials',
            'preferredSingleSignOnMode',
            'preferredTokenSigningKeyThumbprint',
            'resourceSpecificApplicationPermissions',
            'servicePrincipalNames',
            'signInAudience',
            'appManagementPolicy',
            'appRoleAssignments',
          ],
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME]: {
          typeName: DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        [APP_ROLE_ASSIGNMENT_FIELD_NAME]: {
          typeName: SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [DELEGATED_PERMISSION_CLASSIFICATIONS_FIELD_NAME]: {
          standalone: {
            typeName: DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME,
            nestPathUnderParent: true,
            referenceFromParent: false,
          },
        },
      },
    },
  },
  [SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME]: createDefinitionForAppRoleAssignment('servicePrincipals'),
  [DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/servicePrincipals/{id}/delegatedPermissionClassifications',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
          parts: [{ fieldName: 'permissionName' }],
        },
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [OAUTH2_PERMISSION_GRANT_TYPE_NAME]: {
    resource: {
      directFetch: true,
    },
    requests: [
      {
        endpoint: {
          path: '/oauth2PermissionGrants',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            { fieldName: 'clientId', isReference: true },
            { fieldName: 'resourceId', isReference: true },
            { fieldName: 'consentType' },
          ],
        },
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/directory/attributeSets',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'id' }],
        },
      },
    },
  },
  [CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/directory/customSecurityAttributeDefinitions',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME]: {
          typeName: CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'attributeSet', isReference: true }, { fieldName: 'name' }],
        },
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_FIELD_NAME]: {
          standalone: {
            typeName: CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
            nestPathUnderParent: true,
            referenceFromParent: false,
          },
        },
      },
    },
  },
  [CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/directory/customSecurityAttributeDefinitions/{id}/allowedValues',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          adjust: ({ value, context }) => {
            validatePlainObject(value, 'custom security attribute allowed value')
            return {
              value: {
                ...value,
                // The appRoles ids are unique *per custom security attribute definition*, so we need to add the parent_id in order to be able to
                // add its id as part of the serviceIDFields
                parent_id: context.id,
              },
            }
          },
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: ['parent_id', 'id'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
          parts: [{ fieldName: 'id' }],
        },
      },
      fieldCustomizations: {
        parent_id: {
          hide: true,
        },
      },
    },
  },
  [AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/policies/authenticationStrengthPolicies',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DIRECTORY_ROLE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/directoryRoles',
          queryArgs: {
            $expand: 'members',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          adjust: adjustEntitiesWithExpandedMembers,
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DIRECTORY_ROLE_TEMPLATE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/directoryRoleTemplates',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DOMAIN_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/domains',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [DOMAIN_NAME_REFERENCES_FIELD_NAME]: {
          typeName: DOMAIN_NAME_REFERENCE_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
      },
      mergeAndTransform: {
        adjust: ({ value }) => {
          validatePlainObject(value, 'domain')
          return {
            value: {
              ...value,
              // This field is not deployable, and is only used for reference,
              // so we transform it from array of objects to array of ids, which is a cleaner representation
              [DOMAIN_NAME_REFERENCES_FIELD_NAME]: _.get(value, DOMAIN_NAME_REFERENCES_FIELD_NAME, []).map(
                (ref: unknown) => {
                  validatePlainObject(ref, 'domain name reference')

                  return _.get(ref, 'id')
                },
              ),
            },
          }
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'id' }],
        },
      },
    },
  },
  [DOMAIN_NAME_REFERENCE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/domains/{id}/domainNameReferences/microsoft.graph.group',
          queryArgs: {
            $select: 'id',
          },
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
        },
      },
    },
  },
  // TODO SALTO-6073: There's a problem with this API. In the website they're using graph.windows.net, which is the Azure AD API.
  // The docs which specify graph.microsoft.com behave differently. We need to investigate this further.
  [ROLE_DEFINITION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/roleManagement/directory/roleDefinitions',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          // From their API docs: "DO NOT USE. This will be deprecated soon. Attach scope to role assignment."
          // Here: https://learn.microsoft.com/en-us/graph/api/resources/unifiedroledefinition?view=graph-rest-1.0
          omit: ['resourceScopes'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [PERMISSION_GRANT_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/policies/permissionGrantPolicies',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
  [CROSS_TENANT_ACCESS_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/policies/crossTenantAccessPolicy',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
        elemID: {
          parts: [{ fieldName: 'id' }],
        },
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
}

const graphBetaCustomizations: FetchCustomizations = {
  [ADMINISTRATIVE_UNIT_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/administrativeUnits',
          queryArgs: {
            $expand: 'members',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          adjust: adjustEntitiesWithExpandedMembers,
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [AUTHENTICATION_METHOD_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/policies/authenticationMethodsPolicy',
        },
        transformation: {
          pick: ['registrationEnforcement', AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
      fieldCustomizations: {
        [AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME]: {
          standalone: {
            typeName: AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
            nestPathUnderParent: true,
            referenceFromParent: false,
            addParentAnnotation: false,
          },
        },
      },
    },
  },
  [AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME]: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            NAME_ID_FIELD,
            {
              fieldName: 'id',
              // This field is meaningful only for built-in authentication methods, which do not have a displayName
              condition: value => !_.get(value, 'displayName'),
            },
          ],
        },
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [CONDITIONAL_ACCESS_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/identity/conditionalAccess/policies',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/conditionalAccess/namedLocations',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  ...createCustomizationsWithBasePathForFetch(graphV1Customizations, GRAPH_V1_PATH),
  ...createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH),
})

export const createFetchDefinitions = (
  _fetchConfig: UserFetchConfig,
): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
