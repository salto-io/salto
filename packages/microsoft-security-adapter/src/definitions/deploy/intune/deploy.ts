/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData } from '@salto-io/adapter-api'
import { concatAdjustFunctions } from '@salto-io/adapter-components'
import { intuneConstants } from '../../../constants'
import { GRAPH_BETA_PATH } from '../../requests/clients'
import { odataType } from '../../../utils'
import { DeployCustomDefinitions } from '../shared/types'
import { createCustomizationsWithBasePathForDeploy, adjustWrapper } from '../shared/utils'
import { application as applicationDeployUtils, appsConfiguration } from './utils'
import { application, applicationConfiguration } from '../../../utils/intune'
import { DEVICE_CONFIGURATION_TYPE_NAME } from '../../../constants/intune'

const {
  APPLICATION_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
} = intuneConstants

const graphBetaCustomDefinitions: DeployCustomDefinitions = {
  [APPLICATION_TYPE_NAME]: {
    requestsByAction: {
      default: {
        request: {
          transformation: {
            adjust: adjustWrapper(
              concatAdjustFunctions(
                odataType.transformOdataTypeField('deploy'),
                applicationDeployUtils.omitApplicationRedundantFields,
              ),
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
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileApps/{id}',
                method: 'patch',
              },
            },
          },
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
  [APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/targetedManagedAppConfigurations',
                method: 'post',
              },
            },
          },
          appsConfiguration.TARGET_APP_DEPLOY_DEFINITION,
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/targetedManagedAppConfigurations/{id}',
                method: 'patch',
              },
            },
            condition: {
              transformForCheck: {
                omit: ['apps'],
              },
            },
          },
          appsConfiguration.TARGET_APP_DEPLOY_DEFINITION,
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/targetedManagedAppConfigurations/{id}',
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
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceAppManagement/mobileAppConfigurations/{id}',
                method: 'patch',
              },
            },
          },
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
  [DEVICE_CONFIGURATION_TYPE_NAME]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/deviceConfigurations',
                method: 'post',
              },
            },
          },
        ],
        modify: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/deviceConfigurations/{id}',
                method: 'patch',
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: '/deviceManagement/deviceConfigurations/{id}',
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
}

export const createIntuneCustomizations = (): DeployCustomDefinitions =>
  createCustomizationsWithBasePathForDeploy(graphBetaCustomDefinitions, GRAPH_BETA_PATH)
