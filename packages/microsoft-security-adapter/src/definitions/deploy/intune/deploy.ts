/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData } from '@salto-io/adapter-api'
import { intuneConstants } from '../../../constants'
import { GRAPH_BETA_PATH } from '../../requests/clients'
import { transformOdataTypeField } from '../../../utils/shared'
import { DeployCustomDefinitions } from '../shared/types'
import { createCustomizationsWithBasePathForDeploy, omitReadOnlyFieldsWrapper } from '../shared/utils'
import { intuneUtils } from '../../../utils'
import { transformManagedGooglePlayApp } from './utils'

const { APPLICATION_TYPE_NAME } = intuneConstants
const { isManagedGooglePlayApp } = intuneUtils

const graphBetaCustomDefinitions: DeployCustomDefinitions = {
  [APPLICATION_TYPE_NAME]: {
    requestsByAction: {
      default: {
        request: {
          transformation: {
            adjust: omitReadOnlyFieldsWrapper(transformOdataTypeField('deploy')),
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
                adjust: omitReadOnlyFieldsWrapper(transformManagedGooglePlayApp),
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
}

export const createIntuneCustomizations = (): DeployCustomDefinitions =>
  createCustomizationsWithBasePathForDeploy(graphBetaCustomDefinitions, GRAPH_BETA_PATH)
