/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { Options } from '../../types'
import { DEFAULT_FIELD_CUSTOMIZATIONS, DEFAULT_ID_PARTS } from './defaults'
import { createEntraCustomizations } from '../entra/fetch'
import { createIntuneCustomizations } from '../intune/fetch'
import { MicrosoftServicesToManage } from '../../../auth'

const createCustomizations = (
  servicesToManage: MicrosoftServicesToManage,
): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  ...createEntraCustomizations({ entraExtended: Boolean(servicesToManage.Entra) }),
  ...(servicesToManage.Intune ? createIntuneCustomizations() : {}),
})

export const createFetchDefinitions = (
  servicesToManage: MicrosoftServicesToManage,
): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
        onError: fetchUtils.errors.createGetInsufficientPermissionsErrorFunction([403])
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(servicesToManage),
  },
})
