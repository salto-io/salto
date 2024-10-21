/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { naclCase, validatePlainObject } from '@salto-io/adapter-utils'
import { EndpointPath, Options } from '../../types'
import { GRAPH_BETA_PATH } from '../../requests/clients'
import { FetchCustomizations } from '../shared/types'
import { intuneConstants } from '../../../constants'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE, NAME_ID_FIELD } from '../shared/defaults'
import { odataType } from '../../../utils'
import { applicationConfiguration } from '../../../utils/intune'
import { createCustomizationsWithBasePathForFetch } from '../shared/utils'
import { application, deviceConfiguration, deviceConfigurationSettings, platformScript } from './utils'
import { ASSIGNMENT_FIELD_CUSTOMIZATION } from './utils/group_assignments'

const {
  // Top level types
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
  // Nested types
  DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME,
  DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME,
  DEVICE_COMPLIANCE_SCHEDULED_ACTION_CONFIGURATIONS_TYPE_NAME,
  PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME,
  SCOPE_TAG_ASSIGNMENTS_TYPE_NAME,
  // Field names
  ASSIGNMENTS_FIELD_NAME,
  // Other
  SERVICE_BASE_URL,
  ASSIGNMENTS_ODATA_CONTEXT,
  TYPES_WITH_GROUP_ASSIGNMENTS_ASSIGNMENTS,
  TYPES_WITH_TARGET_APPS_APPS,
  TYPES_WITH_TARGET_APPS_PATH_MAP,
} = intuneConstants

const graphBetaCustomizations: FetchCustomizations = {
  [APPLICATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceAppManagement/mobileApps',
          queryArgs: {
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          // TODO SALTO-6483: We need to store the largeIcon as a static file, for now we omit it
          omit: ['largeIcon', ASSIGNMENTS_ODATA_CONTEXT],
          adjust: odataType.transformOdataTypeField('fetch'),
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [application.APPLICATION_TYPE_PART, ...application.APPLICATION_NAME_PARTS],
        },
        path: {
          pathParts: [{ parts: [application.APPLICATION_TYPE_PART] }, { parts: application.APPLICATION_NAME_PARTS }],
        },
        alias: { aliasComponents: [NAME_ID_FIELD] },
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune_Apps/SettingsMenu/~/2/appId/{id}',
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        ...application.APPLICATION_FIELDS_TO_OMIT,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  [APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME]: {
    resource: {
      directFetch: true,
    },
    requests: [
      {
        endpoint: {
          path: '/deviceAppManagement/mobileAppConfigurations',
          queryArgs: {
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', ASSIGNMENTS_ODATA_CONTEXT],
          adjust: applicationConfiguration.parseApplicationConfigurationBinaryFields('fetch'),
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune_Apps/AppConfigPolicySettingsMenu/~/2/appConfigPolicyId/{id}',
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  [APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceAppManagement/mdmWindowsInformationProtectionPolicies',
          queryArgs: {
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', 'isAssigned', ASSIGNMENTS_ODATA_CONTEXT],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune/PolicyInstanceMenuBlade/~/7/policyId/{id}/policyOdataType/#microsoft.graph.mdmWindowsInformationProtectionPolicy/policyName/{displayName}',
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  [DEVICE_CONFIGURATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/deviceConfigurations',
          queryArgs: {
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', 'supportsScopeTags', ASSIGNMENTS_ODATA_CONTEXT],
          adjust: deviceConfiguration.extractPayloadToStaticFile,
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: `/#view/Microsoft_Intune_DeviceSettings/PolicySummaryReportBlade/policyId/{id}/policyName/${NAME_ID_FIELD.fieldName}/policyJourneyState~/0/policyType~/90/isAssigned~/{isAssigned}`,
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  ...deviceConfigurationSettings.createDeviceConfigurationSettingsFetchDefinition({
    typeName: DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
    settingsTypeName: DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME,
    // We align with the Intune admin center behavior, which shows only the following types
    filter:
      "(platforms eq 'windows10' or platforms eq 'macOS' or platforms eq 'iOS') and (technologies has 'mdm' or technologies has 'windows10XManagement' or technologies has 'appleRemoteManagement') and (templateReference/templateFamily eq 'none')",
    serviceUrlPath:
      '/#view/Microsoft_Intune_Workflows/PolicySummaryBlade/policyId/{id}/isAssigned~/{isAssigned}/technology/mdm/templateId//platformName/{platforms}',
  }),
  [DEVICE_COMPLIANCE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/deviceCompliancePolicies',
          queryArgs: {
            $expand: 'scheduledActionsForRule($expand=scheduledActionConfigurations), assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', 'scheduledActionsForRule@odata.context', ASSIGNMENTS_ODATA_CONTEXT],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: `/#view/Microsoft_Intune_DeviceSettings/CompliancePolicyOverview.ReactView/policyId/{id}/policyName/{${NAME_ID_FIELD.fieldName}}/platform~/0/policyType~/0`,
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  [DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME]: {
    resource: {
      directFetch: false,
    },
    element: {
      fieldCustomizations: {
        id: {
          omit: true,
        },
        [naclCase('scheduledActionConfigurations@odata.context')]: {
          omit: true,
        },
      },
    },
  },
  [DEVICE_COMPLIANCE_SCHEDULED_ACTION_CONFIGURATIONS_TYPE_NAME]: {
    resource: {
      directFetch: false,
    },
    element: {
      fieldCustomizations: {
        id: {
          omit: true,
        },
      },
    },
  },
  [FILTER_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/assignmentFilters',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['payloads'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [NAME_ID_FIELD, { fieldName: 'platform' }],
        },
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune_DeviceSettings/AssignmentFilterSummaryBlade/assignmentFilterId/{id}/filterType~/0',
        },
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  ...deviceConfigurationSettings.createDeviceConfigurationSettingsFetchDefinition({
    typeName: PLATFORM_SCRIPT_LINUX_TYPE_NAME,
    settingsTypeName: PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME,
    filter: "templateReference/TemplateFamily eq 'deviceConfigurationScripts'",
    serviceUrlPath:
      '/#view/Microsoft_Intune_Workflows/PolicySummaryBlade/templateId/{templateReference.templateId}/platformName/Linux/policyId/{id}',
    adjust: platformScript.setLinuxScriptValueAsStaticFile,
  }),
  ...platformScript.createPlatformScriptFetchDefinition({
    typeName: PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
    path: '/deviceManagement/deviceManagementScripts',
    platform: 'Windows',
  }),
  ...platformScript.createPlatformScriptFetchDefinition({
    typeName: PLATFORM_SCRIPT_MAC_OS_TYPE_NAME,
    path: '/deviceManagement/deviceShellScripts',
    platform: 'MacOS',
  }),
  [SCOPE_TAG_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/roleScopeTags',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [ASSIGNMENTS_FIELD_NAME]: {
          typeName: SCOPE_TAG_ASSIGNMENTS_TYPE_NAME,
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
        adjust: async ({ value }) => {
          validatePlainObject(value, SCOPE_TAG_TYPE_NAME)
          return {
            value: {
              ...value,
              // Workaround to allow empty arrays for a recurseInto field
              [ASSIGNMENTS_FIELD_NAME]: value[ASSIGNMENTS_FIELD_NAME] ?? [],
            },
          }
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune_DeviceSettings/ScopeTagSummaryBlade/roleScopeTagId/{id}/roleScopeTagDisplayName/{displayName}',
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
      },
    },
  },
  ..._.mapValues(TYPES_WITH_TARGET_APPS_PATH_MAP, ({ resourcePath, serviceUrlPath }) => ({
    requests: [
      {
        endpoint: {
          path: resourcePath,
          queryArgs: {
            $expand: 'apps,assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', 'isAssigned', 'deployedAppCount', 'apps@odata.context', ASSIGNMENTS_ODATA_CONTEXT],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true as const,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: serviceUrlPath,
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  })),
  ...TYPES_WITH_GROUP_ASSIGNMENTS_ASSIGNMENTS.map(typeName => ({
    [typeName]: {
      ...(typeName === SCOPE_TAG_ASSIGNMENTS_TYPE_NAME
        ? {
            requests: [
              {
                endpoint: {
                  path: '/deviceManagement/roleScopeTags/{id}/assignments' as EndpointPath,
                },
                transformation: DEFAULT_TRANSFORMATION,
              },
            ],
          }
        : {}),
      resource: {
        directFetch: false,
      },
      element: {
        fieldCustomizations: {
          id: {
            omit: true,
          },
          sourceId: {
            omit: true,
          },
        },
      },
    },
  })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
  ...TYPES_WITH_TARGET_APPS_APPS.map(typeName => ({
    [typeName]: {
      resource: {
        directFetch: false,
      },
      element: {
        fieldCustomizations: {
          id: {
            omit: true,
          },
          version: {
            omit: true,
          },
        },
      },
    },
  })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
}

export const createIntuneCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> =>
  createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH)
