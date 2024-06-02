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
import { values } from '@salto-io/lowerdash'
import { definitions } from '@salto-io/adapter-components'
import { UserFetchConfig } from '../../config'
import { Options } from '../types'
import {
  SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  CLAIM_MAPPING_POLICY_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
  DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME,
  GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  HOME_REALM_DISCOVERY_POLICY_TYPE_NAME,
  OAUTH2_PERMISSION_GRANT_TYPE_NAME,
  TOKEN_ISSUANCE_POLICY_TYPE_NAME,
  TOKEN_LIFETIME_POLICY_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  GROUP_TYPE_NAME,
  GROUP_APP_ROLE_ASSIGNMENT_FIELD_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
  GROUP_LIFE_CYCLE_POLICY_TYPE_NAME,
  LIFE_CYCLE_POLICY_TYPE_NAME,
  GROUP_ADDITIONAL_DATA_FIELD_NAME,
  GROUP_ADDITIONAL_DATA_TYPE_NAME,
  ROLE_DEFINITION_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME,
  AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  TOKEN_ISSUANCE_POLICY_FIELD_NAME,
} from '../../constants'
import { GRAPH_BETA_PATH, GRAPH_V1_PATH } from '../requests/clients'

const { isPlainObject } = values

type FetchCustomizations = Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>>

const DEFAULT_FIELDS_TO_HIDE: Record<string, { hide: true }> = {
  created_at: {
    hide: true,
  },
  updated_at: {
    hide: true,
  },
  created_by_id: {
    hide: true,
  },
  updated_by_id: {
    hide: true,
  },
}
const ID_FIELD_TO_HIDE = { id: { hide: true } }

const DEFAULT_FIELDS_TO_OMIT: Record<string, { omit: true }> = {
  _links: {
    omit: true,
  },
  createdDateTime: {
    omit: true,
  },
  renewedDateTime: {
    omit: true,
  },
  '_odata_type@mv': {
    omit: true,
  },
  '_odata_context@mv': {
    omit: true,
  },
  'includeTargets_odata_context@mv': {
    omit: true,
  },
}

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'displayName' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_HIDE,
  DEFAULT_FIELDS_TO_OMIT,
)

const DEFAULT_TRANSFORMATION = { root: 'value' }

const createCustomizationsWithBasePath = (customizations: FetchCustomizations, basePath: string): FetchCustomizations =>
  _.mapValues(customizations, customization => ({
    ...customization,
    requests: customization.requests?.map(req => ({
      ...req,
      endpoint: {
        ...req.endpoint,
        path: `${basePath}${req.endpoint.path}`,
      },
    })),
  }))

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
          if (!isPlainObject(value)) {
            throw new Error('Expected group value to be an object')
          }

          return {
            value: {
              ..._.omit(value, GROUP_ADDITIONAL_DATA_FIELD_NAME),
              ..._.get(value, GROUP_ADDITIONAL_DATA_FIELD_NAME, [])[0],
            },
          }
        },
      },
      recurseInto: {
        [GROUP_APP_ROLE_ASSIGNMENT_FIELD_NAME]: {
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
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [GROUP_APP_ROLE_ASSIGNMENT_FIELD_NAME]: {
          standalone: {
            typeName: GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
            addParentAnnotation: true,
            nestPathUnderParent: true,
            referenceFromParent: true,
          },
        },
      },
    },
  },
  [GROUP_ADDITIONAL_DATA_TYPE_NAME]: {
    requests: [
      {
        // TODO: for some groups it throws an odd 404 error, with "code":"MailboxNotEnabledForRESTAPI","message":"The mailbox is either inactive, soft-deleted, or is hosted on-premise."
        // We should investigate this further
        endpoint: {
          path: '/groups/{id}?$select=assignedLabels,assignedLicenses,autoSubscribeNewMembers,hideFromAddressLists,hideFromOutlookClients,licenseProcessingState',
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
  [GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/groups/{id}/appRoleAssignments',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          pick: ['id', 'appRoleId', 'resourceId'],
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            { fieldName: 'appRoleId', isReference: true },
            { fieldName: 'resourceId', isReference: true },
          ],
        },
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
      },
    },
  },
  // We fetch it only for reference purposes, since we don't receive it with the group data
  [GROUP_LIFE_CYCLE_POLICY_TYPE_NAME]: {
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
        elemID: {
          parts: [{ fieldName: 'managedGroupTypes' }, { fieldName: 'groupLifetimeInDays' }],
        },
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
      },
    },
  },
  [APPLICATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/applications',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['templateId'],
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [TOKEN_ISSUANCE_POLICY_FIELD_NAME]: {
          typeName: TOKEN_ISSUANCE_POLICY_TYPE_NAME,
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
        appId: {
          hide: true,
        },
        appRoles: {
          sort: {
            properties: [{ path: 'displayName' }],
          },
        },
        [TOKEN_ISSUANCE_POLICY_FIELD_NAME]: {
          standalone: {
            typeName: TOKEN_ISSUANCE_POLICY_TYPE_NAME,
            nestPathUnderParent: true,
            referenceFromParent: false,
          },
        },
      },
    },
  },
  [TOKEN_ISSUANCE_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/applications/{id}/tokenIssuancePolicies',
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
        appRoleAssignments: {
          typeName: SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        oauth2PermissionGrants: {
          typeName: OAUTH2_PERMISSION_GRANT_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        delegatedPermissionClassifications: {
          typeName: DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        claimMappingPolicies: {
          typeName: CLAIM_MAPPING_POLICY_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        homeRealmDiscoveryPolicies: {
          typeName: HOME_REALM_DISCOVERY_POLICY_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        tokenLifetimePolicies: {
          typeName: TOKEN_LIFETIME_POLICY_TYPE_NAME,
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
      },
    },
  },
  [SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/servicePrincipals/{id}/appRoleAssignments',
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
  [OAUTH2_PERMISSION_GRANT_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/servicePrincipals/{id}/oauth2PermissionGrants',
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
        },
      },
    },
  },
  [CLAIM_MAPPING_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/servicePrincipals/{id}/claimsMappingPolicies',
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
  [HOME_REALM_DISCOVERY_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/servicePrincipals/{id}/homeRealmDiscoveryPolicies',
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
  [TOKEN_LIFETIME_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/servicePrincipals/{id}/tokenLifetimePolicies',
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
  permissionGrantPolicy: {
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
    },
  },
  crossTenantAccessPolicy: {
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
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
      },
    },
  },
  customSecurityAttributeDefinition: {
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
        allowedValues: {
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
      },
    },
  },
  [CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/directory/customSecurityAttributeDefinitions/{id}/allowedValues',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
  },
  device: {
    requests: [
      {
        endpoint: {
          path: '/devices',
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
  [ROLE_DEFINITION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/roleManagement/directory/roleDefinitions',
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
      },
    },
  },
  domain: {
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
  authenticationStrengthPolicy: {
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
    },
  },
}

const graphBetaCustomizations: FetchCustomizations = {
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
              condition: value => !_.get(value, 'displayName'),
            },
          ],
        },
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        '_odata_type@mv': {
          omit: false,
        },
      },
    },
  },
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  ...createCustomizationsWithBasePath(graphV1Customizations, GRAPH_V1_PATH),
  ...createCustomizationsWithBasePath(graphBetaCustomizations, GRAPH_BETA_PATH),
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
