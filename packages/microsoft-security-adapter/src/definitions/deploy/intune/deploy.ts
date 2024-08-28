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
import { transformOdataTypeField } from '../../../utils/shared'
import { DeployCustomDefinitions } from '../shared/types'
import { createCustomizationsWithBasePathForDeploy, omitReadOnlyFieldsWrapper } from '../shared/utils'
import { intuneUtils } from '../../../utils'
import { applications, appsConfiguration } from './utils'

const { APPLICATION_TYPE_NAME, APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME } = intuneConstants
const { isManagedGooglePlayApp } = intuneUtils

const graphBetaCustomDefinitions: DeployCustomDefinitions = {
  [APPLICATION_TYPE_NAME]: {
    requestsByAction: {
      default: {
        request: {
          transformation: {
            adjust: omitReadOnlyFieldsWrapper(
              concatAdjustFunctions(transformOdataTypeField('deploy'), applications.omitApplicationRedundantFields),
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
                  !isManagedGooglePlayApp(getChangeData(change).value),
            },
          },
          {
            request: {
              endpoint: {
                path: '/deviceManagement/androidManagedStoreAccountEnterpriseSettings/addApps',
                method: 'post',
              },
              transformation: {
                adjust: omitReadOnlyFieldsWrapper(applications.transformManagedGooglePlayApp),
              },
            },
            condition: {
              custom:
                () =>
                ({ change }) =>
                  isManagedGooglePlayApp(getChangeData(change).value),
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
}

export const createIntuneCustomizations = (): DeployCustomDefinitions =>
  createCustomizationsWithBasePathForDeploy(graphBetaCustomDefinitions, GRAPH_BETA_PATH)
