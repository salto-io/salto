/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { intuneConstants } from '../../../../constants'

const { TYPES_WITH_GROUP_ASSIGNMENTS_ASSIGNMENTS } = intuneConstants

export const GROUP_ASSIGNMENTS_FETCH_DEFINITIONS = TYPES_WITH_GROUP_ASSIGNMENTS_ASSIGNMENTS.map(typeName => ({
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
})).reduce((acc, curr) => ({ ...acc, ...curr }), {})
