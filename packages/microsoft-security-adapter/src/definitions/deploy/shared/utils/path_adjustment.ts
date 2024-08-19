/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { DeployCustomDefinitions, DeployRequestDefinition } from '../types'

export const createCustomizationsWithBasePath = (
  customizations: DeployCustomDefinitions,
  basePath: string,
): DeployCustomDefinitions =>
  _.mapValues(customizations, customization => ({
    ...customization,
    requestsByAction: {
      ...customization.requestsByAction,
      customizations: {
        ..._.mapValues(customization.requestsByAction?.customizations, actionCustomizations =>
          (actionCustomizations ?? []).map(action => ({
            ...action,
            request: {
              ...action.request,
              ...((action.request.endpoint
                ? { endpoint: { ...action.request.endpoint, path: `${basePath}${action.request.endpoint.path}` } }
                : {}) as DeployRequestDefinition['endpoint']),
            },
          })),
        ),
      },
    },
  }))
