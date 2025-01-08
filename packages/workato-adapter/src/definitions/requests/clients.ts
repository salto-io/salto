/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { WorkatoOptions } from '../types'

export const DEFAULT_PAGE_SIZE = '10'
const RECIPE_PAGE_SIZE = '100' // maximum page allowed for /recipes

export const createClientDefinitions = (
  clients: Record<
    definitions.ResolveClientOptionsType<WorkatoOptions>,
    definitions.RESTApiClientDefinition<definitions.ResolvePaginationOptionsType<WorkatoOptions>>['httpClient']
  >,
): definitions.ApiDefinitions<WorkatoOptions>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
      endpoints: {
        default: {
          get: {
            pagination: 'pageOffset',
            queryArgs: { per_page: DEFAULT_PAGE_SIZE },
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
        },
        customizations: {
          '/connections': {
            get: {
              pagination: 'none',
              queryArgs: {},
            },
          },
          '/recipes': {
            get: {
              pagination: 'minSinceId',
              queryArgs: { per_page: RECIPE_PAGE_SIZE },
            },
          },
        },
      },
    },
  },
})
