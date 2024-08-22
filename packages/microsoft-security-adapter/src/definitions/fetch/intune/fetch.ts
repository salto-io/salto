/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../../types'
import { GRAPH_BETA_PATH } from '../../requests/clients'
import { FetchCustomizations } from '../shared/types'
import { intuneConstants } from '../../../constants'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE, NAME_ID_FIELD } from '../shared/defaults'
import { transformOdataTypeField } from '../../../utils/shared'
import { createCustomizationsWithBasePathForFetch } from '../shared/utils'
import { APPLICATION_FIELDS_TO_OMIT, APPLICATION_NAME_PARTS, APPLICATION_TYPE_PART } from './utils'

const {
  APPLICATION_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME,
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
          adjust: transformOdataTypeField('fetch'),
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
          parts: [APPLICATION_TYPE_PART, ...APPLICATION_NAME_PARTS],
        },
        path: {
          pathParts: [{ parts: [APPLICATION_TYPE_PART] }, { parts: APPLICATION_NAME_PARTS }],
        },
        alias: { aliasComponents: [NAME_ID_FIELD] },
        serviceUrl: {
          baseUrl: 'https://intune.microsoft.com',
          path: '/#view/Microsoft_Intune_Apps/SettingsMenu/~/2/appId/{id}',
        },
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        ...APPLICATION_FIELDS_TO_OMIT,
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
          baseUrl: 'https://intune.microsoft.com',
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
}

export const createIntuneCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> =>
  createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH)
