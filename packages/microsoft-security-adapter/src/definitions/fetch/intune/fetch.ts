/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { naclCase } from '@salto-io/adapter-utils'
import { Options } from '../../types'
import { GRAPH_BETA_PATH } from '../../requests/clients'
import { FetchCustomizations } from '../shared/types'
import { intuneConstants } from '../../../constants'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE, NAME_ID_FIELD } from '../shared/defaults'
import { odataType } from '../../../utils'
import { applicationConfiguration } from '../../../utils/intune'
import { createCustomizationsWithBasePathForFetch } from '../shared/utils'
import { application, deviceConfigurationSettings } from './utils'

const {
  // Top level types
  APPLICATION_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
  DEVICE_CONFIGURATION_TYPE_NAME,
  DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
  DEVICE_COMPLIANCE_TYPE_NAME,
  FILTER_TYPE_NAME,
  PLATFORM_SCRIPT_LINUX_TYPE_NAME,

  // Nested types
  APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME,
  DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME,
  DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME,
  DEVICE_COMPLIANCE_SCHEDULED_ACTION_CONFIGURATIONS_TYPE_NAME,
  PLATFORM_SCRIPT_SETTINGS_TYPE_NAME,

  // Field names
  SETTINGS_FIELD_NAME,
  SETTING_COUNT_FIELD_NAME,

  // Other
  SERVICE_BASE_URL,
  ASSIGNMENTS_ODATA_CONTEXT,
  TYPES_WITH_GROUP_ASSIGNMENTS_ASSIGNMENTS,
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
      },
    },
  },
  [APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceAppManagement/targetedManagedAppConfigurations',
          queryArgs: {
            $expand: 'apps, assignments',
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
        isTopLevel: true,
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune/TargetedAppConfigInstanceBlade/~/fullscreensummary/id/{id}/odataType/undefined',
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME]: {
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
      fieldCustomizations: ID_FIELD_TO_HIDE,
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
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/configurationPolicies',
          queryArgs: {
            $filter:
              // We align with the ui behavior, which shows only the following types
              "(platforms eq 'windows10' or platforms eq 'macOS' or platforms eq 'iOS') and (technologies has 'mdm' or technologies has 'windows10XManagement' or technologies has 'appleRemoteManagement') and (templateReference/templateFamily eq 'none')",
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: [SETTING_COUNT_FIELD_NAME, ASSIGNMENTS_ODATA_CONTEXT],
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [SETTINGS_FIELD_NAME]: {
          typeName: DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME,
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
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune_Workflows/PolicySummaryBlade/policyId/{id}/isAssigned~/{isAssigned}/technology/mdm/templateId//platformName/{platforms}',
        },
        elemID: {
          parts: [{ fieldName: 'name' }],
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME]:
    deviceConfigurationSettings.DEVICE_CONFIGURATION_SETTINGS_FETCH_DEFINITION,
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
      fieldCustomizations: ID_FIELD_TO_HIDE,
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
  [PLATFORM_SCRIPT_LINUX_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/configurationPolicies',
          queryArgs: {
            $filter: "templateReference/TemplateFamily eq 'deviceConfigurationScripts'",
            $expand: 'assignments',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: [SETTING_COUNT_FIELD_NAME, ASSIGNMENTS_ODATA_CONTEXT],
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        [SETTINGS_FIELD_NAME]: {
          typeName: PLATFORM_SCRIPT_SETTINGS_TYPE_NAME,
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
        adjust: deviceConfigurationSettings.setScriptValueAsStaticFile,
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'name' }],
        },
        serviceUrl: {
          baseUrl: SERVICE_BASE_URL,
          path: '/#view/Microsoft_Intune_Workflows/PolicySummaryBlade/templateId/{templateReference.templateId}/platformName/Linux/policyId/{id}',
        },
        allowEmptyArrays: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [PLATFORM_SCRIPT_SETTINGS_TYPE_NAME]: deviceConfigurationSettings.DEVICE_CONFIGURATION_SETTINGS_FETCH_DEFINITION,
  ...TYPES_WITH_GROUP_ASSIGNMENTS_ASSIGNMENTS.map(typeName => ({
    [typeName]: {
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
}

export const createIntuneCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> =>
  createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH)
