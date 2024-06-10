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
import { definitions, deployment } from '@salto-io/adapter-components'
import {
  ADMINISTRATIVE_UNIT_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  AUTHENTICATION_METHOD_POLICY_TYPE_NAME,
  AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  GROUP_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  ROLE_DEFINITION_TYPE_NAME,
  DELEGATED_PERMISSION_CLASSIFICATION_TYPE_NAME,
  OAUTH2_PERMISSION_GRANT_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME,
  CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME,
  DOMAIN_TYPE_NAME,
  LIFE_CYCLE_POLICY_TYPE_NAME,
  GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  GROUP_LIFE_CYCLE_POLICY_FIELD_NAME,
} from '../../constants'
import { AdditionalAction, ClientOptions } from '../types'
import { GRAPH_BETA_PATH, GRAPH_V1_PATH } from '../requests/clients'
import { DeployCustomDefinitions, DeployRequestDefinition } from './types'
import {
  adjustRoleDefinitionForDeployment,
  createCustomizationsWithBasePathForDeploy,
  createDefinitionForAppRoleAssignment,
  createDefinitionForGroupLifecyclePolicyGroupModification,
  getGroupLifecyclePolicyGroupModificationRequest,
  omitReadOnlyFields,
} from './utils'

const AUTHENTICATION_STRENGTH_POLICY_DEPLOYABLE_FIELDS = ['displayName', 'description']

const SERVICE_PRINCIPAL_MODIFICATION_REQUEST: DeployRequestDefinition = {
  endpoint: {
    path: '/servicePrincipals/{id}',
    method: 'patch',
  },
}

const APPLICATION_MODIFICATION_REQUEST: DeployRequestDefinition = {
  endpoint: {
    path: '/applications/{id}',
    method: 'patch',
  },
}

const graphV1CustomDefinitions: DeployCustomDefinitions = {
  ...createDefinitionForAppRoleAssignment({
    parentResourceName: 'groups',
    typeName: GROUP_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  }),
  ...createDefinitionForAppRoleAssignment({
    parentResourceName: 'servicePrincipals',
    typeName: SERVICE_PRINCIPAL_APP_ROLE_ASSIGNMENT_TYPE_NAME,
  }),
  [ADMINISTRATIVE_UNIT_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/directory/administrativeUnits',
                method: 'post',
              },
              transformation: {
                omit: ['members'],
              },
            },
          },
          // TODO SALTO-6051: handle members addition
        ],
        // TODO SALTO-6051: handle members modification
        modify: [
          {
            request: {
              endpoint: {
                path: '/directory/administrativeUnits/{id}',
                method: 'patch',
              },
              transformation: {
                omit: ['members'],
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/directory/administrativeUnits/{id}',
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
        ],
        modify: [
          {
            request: APPLICATION_MODIFICATION_REQUEST,
          },
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
            },
          },
          {
            request: getGroupLifecyclePolicyGroupModificationRequest('add'),
            condition: {
              transformForCheck: {
                pick: [GROUP_LIFE_CYCLE_POLICY_FIELD_NAME],
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/groups/{id}',
                method: 'patch',
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
              },
            },
          },
          // TODO SALTO-6051: add and modify members array
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/directoryRoles/{id}',
                method: 'patch',
              },
            },
            condition: {
              transformForCheck: {
                pick: ['members'],
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
                path: '/deviceManagement/roleDefinitions',
                method: 'post',
              },
              transformation: {
                adjust: adjustRoleDefinitionForDeployment,
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/roleDefinitions/{id}',
                method: 'patch',
              },
              transformation: {
                adjust: adjustRoleDefinitionForDeployment,
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/roleDefinitions/{id}',
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

const createCustomizations = (): DeployCustomDefinitions => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({})

  return _.merge(standardRequestDefinitions, {
    ...createCustomizationsWithBasePathForDeploy(graphV1CustomDefinitions, GRAPH_V1_PATH),
    ...createCustomizationsWithBasePathForDeploy(graphBetaCustomDefinitions, GRAPH_BETA_PATH),
  })
}

export const createDeployDefinitions = (): definitions.deploy.DeployApiDefinitions<never, ClientOptions> => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
            transformation: {
              adjust: omitReadOnlyFields,
            },
          },
          condition: {
            transformForCheck: {
              adjust: omitReadOnlyFields,
            },
          },
        },
        customizations: {},
      },
      changeGroupId: deployment.grouping.selfGroup,
    },
    customizations: createCustomizations(),
  },
})
