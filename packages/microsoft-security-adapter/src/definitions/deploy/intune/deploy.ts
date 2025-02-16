/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { getChangeData } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { intuneConstants } from '../../../constants'
import { GRAPH_BETA_PATH } from '../../requests/clients'
import { odataType } from '../../../utils'
import { DeployCustomDefinitions, InstanceDeployApiDefinitions } from '../shared/types'
import { createCustomizationsWithBasePathForDeploy, adjustWrapper } from '../shared/utils'
import { application as applicationDeployUtils, targetApps, deviceConfigurationSettings, assignments } from './utils'
import { application, applicationConfiguration } from '../../../utils/intune'
import { AdditionalAction, ClientOptions } from '../../types'

const {
  // Type names
  TOP_LEVEL_TYPES: {
    APPLICATION_TYPE_NAME,
    APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
    APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME,
    DEVICE_CONFIGURATION_TYPE_NAME,
    DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
    DEVICE_COMPLIANCE_TYPE_NAME,
    FILTER_TYPE_NAME,
    PLATFORM_SCRIPT_LINUX_TYPE_NAME,
    PLATFORM_SCRIPT_MAC_OS_TYPE_NAME,
    PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
    SCOPE_TAG_TYPE_NAME,
  },
  // Field names
  APPS_FIELD_NAME,
  SCHEDULED_ACTIONS_FIELD_NAME,
  ASSIGNMENTS_FIELD_NAME,
  // Other
  TYPES_WITH_TARGET_APPS_PATH_MAP,
} = intuneConstants

const graphBetaStandardDeployDefinitions = deployment.helpers.createStandardDeployDefinitions<
  AdditionalAction,
  ClientOptions
>({
  [FILTER_TYPE_NAME]: { bulkPath: '/deviceManagement/assignmentFilters', modificationMethod: 'patch' },
})

const graphBetaCustomDefinitions: DeployCustomDefinitions = {
  [APPLICATION_TYPE_NAME]: {
    requestsByAction: {
      default: {
        request: {
          transformation: {
            adjust: adjustWrapper(
              odataType.transformOdataTypeField('deploy'),
              applicationDeployUtils.omitApplicationRedundantFields,
            ),
          },
        },
      },
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileApps',
                method: 'post',
              },
              transformation: {
                omit: [ASSIGNMENTS_FIELD_NAME, 'size'],
              },
            },
            condition: {
              custom:
                () =>
                ({ change }) =>
                  !application.isManagedGooglePlayApp(getChangeData(change).value),
            },
          },
          {
            request: {
              endpoint: {
                path: '/deviceManagement/androidManagedStoreAccountEnterpriseSettings/addApps',
                method: 'post',
              },
              transformation: {
                omit: [ASSIGNMENTS_FIELD_NAME],
                adjust: adjustWrapper(applicationDeployUtils.transformManagedGooglePlayApp),
              },
            },
            condition: {
              custom:
                () =>
                ({ change }) =>
                  application.isManagedGooglePlayApp(getChangeData(change).value),
            },
          },
          // The id of the newly created app is not returned in the response of the managedGooglePlayApp endpoint,
          // so we manually fetch it after the app is created.
          {
            request: {
              endpoint: {
                path: applicationDeployUtils.GET_MANAGED_STORE_APP_POST_DEPLOY_PATH,
                method: 'get',
              },
            },
            condition: {
              custom:
                () =>
                ({ change }) =>
                  application.isManagedGooglePlayApp(getChangeData(change).value),
            },
            copyFromResponse: {
              additional: {
                root: 'value',
                pick: ['id'],
              },
            },
          },
          assignments.createAssignmentsRequest({
            resourcePath: '/deviceAppManagement/mobileApps',
            rootField: applicationDeployUtils.DEPLOY_ASSIGNMENTS_ROOT_FIELD_NAME,
          }),
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileApps/{id}',
                method: 'patch',
              },
              transformation: {
                omit: [ASSIGNMENTS_FIELD_NAME],
              },
            },
            condition: {
              transformForCheck: {
                omit: [ASSIGNMENTS_FIELD_NAME],
              },
            },
          },
          assignments.createAssignmentsRequest({
            resourcePath: '/deviceAppManagement/mobileApps',
            rootField: applicationDeployUtils.DEPLOY_ASSIGNMENTS_ROOT_FIELD_NAME,
          }),
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileApps/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME]: {
    requestsByAction: {
      default: {
        request: {
          transformation: {
            adjust: adjustWrapper(applicationConfiguration.parseApplicationConfigurationBinaryFields('deploy')),
          },
        },
      },
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileAppConfigurations',
                method: 'post',
              },
              transformation: {
                omit: [ASSIGNMENTS_FIELD_NAME],
              },
            },
          },
          assignments.createAssignmentsRequest({
            resourcePath: '/deviceAppManagement/mobileAppConfigurations',
          }),
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileAppConfigurations/{id}',
                method: 'patch',
              },
              transformation: {
                omit: [ASSIGNMENTS_FIELD_NAME],
              },
            },
            condition: {
              transformForCheck: {
                omit: [ASSIGNMENTS_FIELD_NAME],
              },
            },
          },
          assignments.createAssignmentsRequest({
            resourcePath: '/deviceAppManagement/mobileAppConfigurations',
          }),
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileAppConfigurations/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME]: {
    requestsByAction: assignments.createBasicDeployDefinitionForTypeWithAssignments({
      resourcePath: '/deviceAppManagement/mdmWindowsInformationProtectionPolicies',
    }),
  },
  [DEVICE_CONFIGURATION_TYPE_NAME]: {
    requestsByAction: assignments.createBasicDeployDefinitionForTypeWithAssignments({
      resourcePath: '/deviceManagement/deviceConfigurations',
    }),
  },
  [DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME]:
    deviceConfigurationSettings.DEVICE_CONFIGURATION_SETTINGS_DEPLOY_DEFINITION,
  [DEVICE_COMPLIANCE_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/deviceCompliancePolicies',
                method: 'post',
              },
              transformation: {
                omit: [ASSIGNMENTS_FIELD_NAME],
              },
            },
          },
          assignments.createAssignmentsRequest({
            resourcePath: '/deviceManagement/deviceCompliancePolicies',
          }),
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/deviceCompliancePolicies/{id}',
                method: 'patch',
              },
              transformation: {
                omit: [SCHEDULED_ACTIONS_FIELD_NAME, ASSIGNMENTS_FIELD_NAME],
              },
            },
            condition: {
              transformForCheck: {
                omit: [SCHEDULED_ACTIONS_FIELD_NAME, ASSIGNMENTS_FIELD_NAME],
              },
            },
          },
          {
            request: {
              endpoint: {
                path: '/deviceManagement/deviceCompliancePolicies/{id}/scheduleActionsForRules',
                method: 'post',
              },
              transformation: {
                rename: [
                  {
                    from: SCHEDULED_ACTIONS_FIELD_NAME,
                    to: 'deviceComplianceScheduledActionForRules',
                    onConflict: 'skip',
                  },
                ],
                pick: ['deviceComplianceScheduledActionForRules'],
              },
            },
            condition: {
              transformForCheck: {
                pick: [SCHEDULED_ACTIONS_FIELD_NAME],
              },
            },
          },
          assignments.createAssignmentsRequest({
            resourcePath: '/deviceManagement/deviceCompliancePolicies',
          }),
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/deviceCompliancePolicies/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
  [PLATFORM_SCRIPT_LINUX_TYPE_NAME]: deviceConfigurationSettings.DEVICE_CONFIGURATION_SETTINGS_DEPLOY_DEFINITION,
  [PLATFORM_SCRIPT_WINDOWS_TYPE_NAME]: {
    requestsByAction: assignments.createBasicDeployDefinitionForTypeWithAssignments({
      resourcePath: '/deviceManagement/deviceManagementScripts',
      assignmentRootField: 'deviceManagementScriptAssignments',
    }),
  },
  [PLATFORM_SCRIPT_MAC_OS_TYPE_NAME]: {
    requestsByAction: assignments.createBasicDeployDefinitionForTypeWithAssignments({
      resourcePath: '/deviceManagement/deviceShellScripts',
      assignmentRootField: 'deviceManagementScriptAssignments',
    }),
  },
  [SCOPE_TAG_TYPE_NAME]: {
    requestsByAction: assignments.createBasicDeployDefinitionForTypeWithAssignments({
      resourcePath: '/deviceManagement/roleScopeTags',
    }),
    changeGroupId: deployment.grouping.groupByType,
    concurrency: 1,
  },
  ..._.mapValues(
    TYPES_WITH_TARGET_APPS_PATH_MAP,
    ({ resourcePath, targetTypeFieldName }): InstanceDeployApiDefinitions => ({
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: resourcePath,
                  method: 'post',
                },
                transformation: {
                  omit: [APPS_FIELD_NAME, ASSIGNMENTS_FIELD_NAME],
                },
              },
            },
            targetApps.createTargetAppsDeployDefinition({ resourcePath, targetTypeFieldName }),
            assignments.createAssignmentsRequest({ resourcePath }),
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: `${resourcePath}/{id}`,
                  method: 'patch',
                },
                transformation: {
                  omit: [APPS_FIELD_NAME, ASSIGNMENTS_FIELD_NAME],
                },
              },
              condition: {
                transformForCheck: {
                  omit: [APPS_FIELD_NAME, ASSIGNMENTS_FIELD_NAME],
                },
              },
            },
            targetApps.createTargetAppsDeployDefinition({ resourcePath, targetTypeFieldName }),
            assignments.createAssignmentsRequest({ resourcePath }),
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: `${resourcePath}/{id}`,
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
    }),
  ),
}

export const createIntuneCustomizations = (): DeployCustomDefinitions =>
  createCustomizationsWithBasePathForDeploy(
    _.merge(graphBetaStandardDeployDefinitions, graphBetaCustomDefinitions),
    GRAPH_BETA_PATH,
  )
