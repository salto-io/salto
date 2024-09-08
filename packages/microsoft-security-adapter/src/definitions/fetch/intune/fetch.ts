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
import { application } from './utils'

const {
  // Top level types
  APPLICATION_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
  DEVICE_CONFIGURATION_TYPE_NAME,
  DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
  DEVICE_COMPLIANCE_TYPE_NAME,

  // Nested types
  APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME,
  DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME,
  DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME,
  DEVICE_COMPLIANCE_SCHEDULED_ACTION_CONFIGURATIONS_TYPE_NAME,

  // Field names
  SETTINGS_FIELD_NAME,

  // Urls
  SERVICE_BASE_URL,
} = intuneConstants

const graphBetaCustomizations: FetchCustomizations = {
  [APPLICATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceAppManagement/mobileApps',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          // TODO SALTO-6483: We need to store the largeIcon as a static file, for now we omit it
          omit: ['largeIcon'],
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
            $expand: 'apps',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', 'isAssigned', 'deployedAppCount', 'apps@odata.context'],
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
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version'],
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
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DEVICE_CONFIGURATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/deviceConfigurations',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', 'supportsScopeTags'],
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
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/configurationPolicies',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['settingCount'],
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
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/configurationPolicies/{id}/settings',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    element: {
      fieldCustomizations: {
        id: {
          omit: true,
        },
      },
    },
  },
  [DEVICE_COMPLIANCE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/deviceCompliancePolicies',
          queryArgs: {
            $expand: 'scheduledActionsForRule($expand=scheduledActionConfigurations)',
          },
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          omit: ['version', 'scheduledActionsForRule@odata.context'],
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
}

export const createIntuneCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> =>
  createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH)
