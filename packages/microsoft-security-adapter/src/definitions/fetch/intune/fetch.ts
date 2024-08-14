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
import { getAdjustedOdataTypeFieldName, transformOdataTypeField } from '../../utils/shared'
import { PACKAGE_ID_FIELD_NAME } from '../../../constants/intune'
import { APPLICATION_OMITTED_FIELDS } from './constants'
import { concatAdjustFunctions, createCustomizationsWithBasePathForFetch, toOmittedFields } from '../shared/utils'
import { omitApplicationRedundantFields } from './utils'

const { APPLICATION_TYPE_NAME } = intuneConstants

const graphBetaCustomizations: FetchCustomizations = {
  [APPLICATION_TYPE_NAME]: {
    resource: {
      directFetch: true,
    },
    requests: [
      {
        endpoint: {
          path: '/deviceAppManagement/mobileApps',
        },
        transformation: {
          ...DEFAULT_TRANSFORMATION,
          // TODO SALTO-6483: We need to store the largeIcon as a static file, for now we omit it
          omit: ['largeIcon'],
          adjust: concatAdjustFunctions(transformOdataTypeField('fetch'), omitApplicationRedundantFields),
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            { fieldName: getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME) },
            // Some ManagedAndroidStoreApp instances have the same name, so instead we use the packageId field,
            // which should be consistent across environments.
            { fieldName: NAME_ID_FIELD.fieldName, condition: value => !value[PACKAGE_ID_FIELD_NAME] },
            { fieldName: PACKAGE_ID_FIELD_NAME },
          ],
        },
        path: {
          pathParts: [
            { parts: [{ fieldName: getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME) }] },
            { parts: [NAME_ID_FIELD, { fieldName: PACKAGE_ID_FIELD_NAME }] },
          ],
        },
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        ...toOmittedFields(APPLICATION_OMITTED_FIELDS),
      },
    },
  },
}

export const createIntuneCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> =>
  createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH)
