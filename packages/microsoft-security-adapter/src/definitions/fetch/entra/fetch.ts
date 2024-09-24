/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { Options } from '../../types'
import { entraConstants, PARENT_ID_FIELD_NAME } from '../../../constants'
import { GRAPH_BETA_PATH, GRAPH_V1_PATH } from '../../requests/clients'
import { FetchCustomizations } from '../shared/types'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE, NAME_ID_FIELD } from '../shared/defaults'
import {
  adjustEntitiesWithExpandedMembers,
  createDefinitionForAppRoleAssignment,
  addParentIdToAppRoles,
  adjustApplication,
} from './utils'
import { CONTEXT_LIFE_CYCLE_POLICY_MANAGED_GROUP_TYPES } from '../../../constants/entra'
import { createCustomizationsWithBasePathForFetch } from '../shared/utils'

const {
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
  APP_ROLE_TYPE_NAME,
} = entraConstants

const APP_ROLES_FIELD_CUSTOMIZATIONS = {
  standalone: {
    typeName: APP_ROLE_TYPE_NAME,
    nestPathUnderParent: true,
    referenceFromParent: false,
  },
}

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
        adjust: async ({ value }) => {
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
      context: {
        // We only need this dependency for the conditions under the group life cycle policy recurse definition
        dependsOn: {
          [CONTEXT_LIFE_CYCLE_POLICY_MANAGED_GROUP_TYPES]: {
            parentTypeName: LIFE_CYCLE_POLICY_TYPE_NAME,
            transformation: {
              root: 'managedGroupTypes',
            },
          },
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
          conditions: [
            {
              fromContext: CONTEXT_LIFE_CYCLE_POLICY_MANAGED_GROUP_TYPES,
              match: ['Selected'],
            },
          ],
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        groupTypes: {
          sort: {
            // This field is an array of strings, so we don't need to specify a path
            properties: [],
          },
        },
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
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          adjust: adjustApplication,
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
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        appId: {
          hide: true,
        },
        [APP_ROLES_FIELD_NAME]: APP_ROLES_FIELD_CUSTOMIZATIONS,
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
          adjust: async ({ value }) => {
            validatePlainObject(value, 'service principal')

            return {
              value: {
                ...value,
                [APP_ROLES_FIELD_NAME]: addParentIdToAppRoles(value),
              },
            }
          },
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
        [APP_ROLES_FIELD_NAME]: APP_ROLES_FIELD_CUSTOMIZATIONS,
        [APP_ROLE_ASSIGNMENT_FIELD_NAME]: {
          standalone: {
            typeName: SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
            nestPathUnderParent: true,
            referenceFromParent: false,
          },
        },
      },
    },
  },
  [APP_ROLE_TYPE_NAME]: {
    resource: {
      directFetch: false,
      serviceIDFields: [PARENT_ID_FIELD_NAME, 'id'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
          parts: [NAME_ID_FIELD, { fieldName: 'value' }],
        },
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
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
          queryArgs: {
            $filter: "consentType eq 'AllPrincipals'",
          },
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
          adjust: async ({ value, context }) => {
            validatePlainObject(value, 'custom security attribute allowed value')
            return {
              value: {
                ...value,
                // The ids are unique *per custom security attribute definition*, so we need to add the parent_id in order to be able to
                // add its id as part of the serviceIDFields
                [PARENT_ID_FIELD_NAME]: context.id,
              },
            }
          },
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: [PARENT_ID_FIELD_NAME, 'id'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
          parts: [{ fieldName: 'id' }],
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
          conditions: [
            {
              fromField: 'authenticationType',
              // Exclude federated domains, as this api call does not support them
              match: ['Managed'],
            },
          ],
        },
      },
      mergeAndTransform: {
        adjust: async ({ value }) => {
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

// These types are always included in the fetch, regardless of the chosen services to manage
const BASIC_ENTRA_TYPES = [GROUP_TYPE_NAME, GROUP_ADDITIONAL_DATA_TYPE_NAME]

export const createEntraCustomizations = ({
  entraExtended,
}: {
  entraExtended: boolean
}): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => {
  const customizations = {
    ...createCustomizationsWithBasePathForFetch(graphV1Customizations, GRAPH_V1_PATH),
    ...createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH),
  }
  return entraExtended
    ? customizations
    : _.pickBy(customizations, (_customization, typeName) => BASIC_ENTRA_TYPES.includes(typeName))
}
