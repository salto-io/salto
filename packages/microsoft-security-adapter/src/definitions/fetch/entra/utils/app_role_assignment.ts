/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { EndpointPath } from '../../../types'
import { FetchApiDefinition } from '../../shared/types'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE } from '../../shared/defaults'

export const createDefinitionForAppRoleAssignment = (parentResourceName: string): FetchApiDefinition => ({
  requests: [
    {
      endpoint: {
        path: `/${parentResourceName}/{id}/appRoleAssignments` as EndpointPath,
      },
      transformation: {
        ...DEFAULT_TRANSFORMATION,
        pick: ['id', 'appRoleId', 'resourceId'],
      },
    },
  ],
  element: {
    topLevel: {
      isTopLevel: true,
      elemID: {
        extendsParent: true,
        parts: [
          { fieldName: 'appRoleId', isReference: true },
          { fieldName: 'resourceId', isReference: true },
        ],
      },
    },
    fieldCustomizations: ID_FIELD_TO_HIDE,
  },
})
