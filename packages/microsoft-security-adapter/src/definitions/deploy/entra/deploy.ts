/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { deployment } from '@salto-io/adapter-components'
import { entraConstants, ODATA_ID_FIELD } from '../../../constants'
import { GRAPH_BETA_PATH, GRAPH_V1_PATH } from '../../requests/clients'
import { DeployCustomDefinitions, DeployRequestDefinition, DeployableRequestDefinition } from '../shared/types'
import {
  createDefinitionForAppRoleAssignment,
  createDefinitionForGroupLifecyclePolicyGroupModification,
  getGroupLifecyclePolicyGroupModificationRequest,
} from './utils'
import {
  createCustomConditionCheckChangesInFields,
  createCustomizationsWithBasePathForDeploy,
  adjustWrapper,
  omitParentIdFromPathAdjustCreator,
} from '../shared/utils'

const {
  TOP_LEVEL_TYPES: {
    ADMINISTRATIVE_UNIT_TYPE_NAME,
    APPLICATION_TYPE_NAME,
    AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
    AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
    CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
    CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
    GROUP_TYPE_NAME,
    SERVICE_PRINCIPAL_TYPE_NAME,
    DIRECTORY_ROLE_TYPE_NAME,
    ROLE_DEFINITION_TYPE_NAME,
    OAUTH2_PERMISSION_GRANT_TYPE_NAME,
    CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
    CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
    DOMAIN_TYPE_NAME,
    LIFE_CYCLE_POLICY_TYPE_NAME,
    APP_ROLE_TYPE_NAME,
    OAUTH2_PERMISSION_SCOPE_TYPE_NAME,
  },
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
  GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
  ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME,
  MEMBERS_FIELD_NAME,
  DIRECTORY_ROLE_MEMBERS_TYPE_NAME,
  API_FIELD_NAME,
  APP_ROLES_FIELD_NAME,
  OAUTH2_PERMISSION_SCOPES_FIELD_NAME,
} = entraConstants

const AUTHENTICATION_STRENGTH_POLICY_DEPLOYABLE_FIELDS = ['displayName', 'description']

const SERVICE_PRINCIPAL_MODIFICATION_REQUEST: DeployRequestDefinition = {
  endpoint: {
    path: '/servicePrincipals/{id}',
    method: 'patch',
  },
  transformation: {
    adjust: adjustWrapper(
      omitParentIdFromPathAdjustCreator(APP_ROLES_FIELD_NAME),
      omitParentIdFromPathAdjustCreator(OAUTH2_PERMISSION_SCOPES_FIELD_NAME),
    ),
  },
}

const APPLICATION_FIELDS_TO_DEPLOY_IN_SECOND_ITERATION = ['web.redirectUriSettings', 'api.preAuthorizedApplications']

const APPLICATION_MODIFICATION_REQUEST: DeployRequestDefinition = {
  endpoint: {
    path: '/applications/{id}',
    method: 'patch',
  },
  transformation: {
    omit: APPLICATION_FIELDS_TO_DEPLOY_IN_SECOND_ITERATION,
    adjust: adjustWrapper(
      omitParentIdFromPathAdjustCreator(APP_ROLES_FIELD_NAME),
      omitParentIdFromPathAdjustCreator(API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME),
    ),
  },
}

const APPLICATION_SECOND_MODIFICATION_ITERATION_REQUEST: DeployableRequestDefinition = {
  request: {
    endpoint: {
      path: '/applications/{id}',
      method: 'patch',
    },
    transformation: {
      pick: APPLICATION_FIELDS_TO_DEPLOY_IN_SECOND_ITERATION,
    },
  },
  condition: createCustomConditionCheckChangesInFields(APPLICATION_FIELDS_TO_DEPLOY_IN_SECOND_ITERATION),
}

// These fields cannot be specified when creating a group, but can be modified after creation
const GROUP_UNDEPLOYABLE_FIELDS_ON_ADDITION = [
  'allowExternalSenders',
  'autoSubscribeNewMembers',
  'hideFromAddressLists',
  'hideFromOutlookClients',
  'isSubscribedByMail',
  'unseenCount',
]

const graphV1CustomDefinitions: DeployCustomDefinitions = {
  ...createDefinitionForAppRoleAssignment({
    parentResourceName: 'groups',
    typeName: GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  }),
  ...createDefinitionForAppRoleAssignment({
    parentResourceName: 'servicePrincipals',
    typeName: SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  }),
  [ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/directory/administrativeUnits/{parent_id}/members/$ref',
                method: 'post',
              },
              transformation: {
                pick: [ODATA_ID_FIELD],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/directory/administrativeUnits/{parent_id}/members/{id}/$ref',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [APPLICATION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/applications',
                method: 'post',
              },
              transformation: {
                pick: ['displayName'],
              },
            },
            copyFromResponse: {
              toSharedContext: {
                pick: ['id'],
              },
              additional: {
                // The appId is hidden, so it won't exist on addition.
                // However, it is used to reference the application from other instances, so we should copy it to the applied change.
                pick: ['appId'],
              },
            },
          },
          {
            request: {
              ...APPLICATION_MODIFICATION_REQUEST,
              context: {
                sharedContext: {
                  id: 'id',
                },
              },
            },
          },
          APPLICATION_SECOND_MODIFICATION_ITERATION_REQUEST,
        ],
        modify: [
          {
            request: APPLICATION_MODIFICATION_REQUEST,
          },
          APPLICATION_SECOND_MODIFICATION_ITERATION_REQUEST,
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/applications/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [APP_ROLE_TYPE_NAME]: {
    changeGroupId: deployment.grouping.groupWithFirstParent,
    // Deploying an application/servicePrincipal with its appRoles is done in a single request using the definition of the application via a filter
    requestsByAction: {},
  },
  [OAUTH2_PERMISSION_SCOPE_TYPE_NAME]: {
    changeGroupId: deployment.grouping.groupWithFirstParent,
    // Deploying an application/servicePrincipal with its oauth2PermissionScopes is done in a single request using the definition of the application via a filter
    requestsByAction: {},
  },
  [SERVICE_PRINCIPAL_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/servicePrincipals',
                method: 'post',
              },
              transformation: {
                pick: ['appId'],
              },
            },
          },
          {
            request: SERVICE_PRINCIPAL_MODIFICATION_REQUEST,
          },
        ],
        modify: [
          {
            request: SERVICE_PRINCIPAL_MODIFICATION_REQUEST,
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/servicePrincipals/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [GROUP_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/groups',
                method: 'post',
              },
              transformation: {
                omit: [...GROUP_UNDEPLOYABLE_FIELDS_ON_ADDITION, GROUP_LIFE_CYCLE_POLICY_FIELD_NAME],
              },
            },
            copyFromResponse: {
              toSharedContext: {
                pick: ['id'],
              },
            },
          },
          {
            request: {
              endpoint: {
                path: '/groups/{id}',
                method: 'patch',
              },
              transformation: {
                pick: GROUP_UNDEPLOYABLE_FIELDS_ON_ADDITION,
              },
            },
            condition: createCustomConditionCheckChangesInFields(GROUP_UNDEPLOYABLE_FIELDS_ON_ADDITION),
          },
          {
            request: getGroupLifecyclePolicyGroupModificationRequest('add'),
            condition: createCustomConditionCheckChangesInFields([GROUP_LIFE_CYCLE_POLICY_FIELD_NAME]),
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/groups/{id}',
                method: 'patch',
              },
              transformation: {
                omit: [GROUP_LIFE_CYCLE_POLICY_FIELD_NAME],
              },
            },
            condition: {
              transformForCheck: {
                omit: [GROUP_LIFE_CYCLE_POLICY_FIELD_NAME],
              },
            },
          },
          createDefinitionForGroupLifecyclePolicyGroupModification('add'),
          createDefinitionForGroupLifecyclePolicyGroupModification('remove'),
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/groups/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationStrengthPolicies',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationStrengthPolicies/{id}',
                method: 'patch',
              },
              transformation: {
                pick: AUTHENTICATION_STRENGTH_POLICY_DEPLOYABLE_FIELDS,
              },
            },
            condition: {
              transformForCheck: {
                pick: AUTHENTICATION_STRENGTH_POLICY_DEPLOYABLE_FIELDS,
              },
            },
          },
          {
            request: {
              endpoint: {
                path: '/policies/authenticationStrengthPolicies/{id}/updateAllowedCombinations',
                method: 'post',
              },
              transformation: {
                pick: ['allowedCombinations'],
              },
            },
            condition: {
              transformForCheck: {
                pick: ['allowedCombinations'],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationStrengthPolicies/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [DIRECTORY_ROLE_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/directoryRoles',
                method: 'post',
              },
              transformation: {
                pick: ['roleTemplateId'],
                omit: [MEMBERS_FIELD_NAME],
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/directoryRoles/{id}',
                method: 'patch',
              },
              transformation: {
                omit: [MEMBERS_FIELD_NAME],
              },
            },
            condition: {
              transformForCheck: {
                omit: [MEMBERS_FIELD_NAME],
              },
            },
          },
        ],
      },
    },
  },
  [DIRECTORY_ROLE_MEMBERS_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/directoryRoles/{parent_id}/members/$ref',
                method: 'post',
              },
              transformation: {
                pick: [ODATA_ID_FIELD],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/directoryRoles/{parent_id}/members/{id}/$ref',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/servicePrincipals/{parent_id}/delegatedPermissionClassifications',
                method: 'post',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/servicePrincipals/{parent_id}/delegatedPermissionClassifications/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [OAUTH2_PERMISSION_GRANT_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/oauth2PermissionGrants',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/oauth2PermissionGrants/{id}',
                method: 'patch',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/oAuth2PermissionGrants/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/directory/customSecurityAttributeDefinitions/{parent_id}/allowedValues',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/directory/customSecurityAttributeDefinitions/{parent_id}/allowedValues/{id}',
                method: 'patch',
              },
            },
          },
        ],
      },
    },
  },
  [CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/directory/customSecurityAttributeDefinitions',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/directory/customSecurityAttributeDefinitions/{id}',
                method: 'patch',
              },
            },
          },
        ],
      },
    },
  },
  [CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/directory/attributeSets',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/directory/attributeSets/{id}',
                method: 'patch',
              },
            },
          },
        ],
      },
    },
  },
  [DOMAIN_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/domains',
                method: 'post',
              },
              // TODO SALTO-6071: We can only specify the id when creating a domain
              // We cannot immediately modify the domain after creation since it should be verified first
              // The verification process requires the appropriate DNS record, but DNS changes can take up to 72 hours
              transformation: {
                pick: ['id'],
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/domains/{id}',
                method: 'patch',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/domains/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [ROLE_DEFINITION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/roleManagement/directory/roleDefinitions',
                method: 'post',
              },
              transformation: {
                omit: ['isBuiltIn'],
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/roleManagement/directory/roleDefinitions/{id}',
                method: 'patch',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/roleManagement/directory/roleDefinitions/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [LIFE_CYCLE_POLICY_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/groupLifecyclePolicies',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/groupLifecyclePolicies/{id}',
                method: 'patch',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/groupLifecyclePolicies/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
}

const graphBetaCustomDefinitions: DeployCustomDefinitions = {
  [ADMINISTRATIVE_UNIT_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/administrativeUnits',
                method: 'post',
              },
              transformation: {
                omit: [MEMBERS_FIELD_NAME],
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/administrativeUnits/{id}',
                method: 'patch',
              },
              transformation: {
                omit: [MEMBERS_FIELD_NAME],
              },
            },
            condition: {
              transformForCheck: {
                omit: [MEMBERS_FIELD_NAME],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/administrativeUnits/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [AUTHENTICATION_METHOD_POLICY_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        modify: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy',
                method: 'patch',
              },
            },
          },
        ],
      },
    },
  },
  [AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/{id}',
                method: 'patch',
              },
              transformation: {
                omit: ['displayName'],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [CONDITIONAL_ACCESS_POLICY_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/policies',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/policies/{id}',
                method: 'patch',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/policies/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/namedLocations',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/namedLocations/{id}',
                method: 'patch',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/identity/conditionalAccess/namedLocations/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
}

export const createEntraCustomizations = (): DeployCustomDefinitions => ({
  ...createCustomizationsWithBasePathForDeploy(graphV1CustomDefinitions, GRAPH_V1_PATH),
  ...createCustomizationsWithBasePathForDeploy(graphBetaCustomDefinitions, GRAPH_BETA_PATH),
})
