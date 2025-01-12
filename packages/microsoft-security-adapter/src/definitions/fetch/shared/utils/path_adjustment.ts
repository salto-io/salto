/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { EndpointPath } from '../../../types'
import { FetchCustomizations } from '../types'

export const createCustomizationsWithBasePath = (
  customizations: FetchCustomizations,
  basePath: EndpointPath,
): FetchCustomizations =>
  _.mapValues(customizations, customization => ({
    ...customization,
    requests: customization.requests?.map(req => ({
      ...req,
      endpoint: {
        ...req.endpoint,
        path: `${basePath}${req.endpoint.path}` as EndpointPath,
      },
    })),
  }))
