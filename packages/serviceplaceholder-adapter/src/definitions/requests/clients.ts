/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../types'

// TODO adjust, remove unnecessary customizations

export const createClientDefinitions = (
  clients: Record<
    definitions.ResolveClientOptionsType<Options>,
    definitions.RESTApiClientDefinition<definitions.ResolvePaginationOptionsType<Options>>['httpClient']
  >,
): definitions.ApiDefinitions<Options>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
      endpoints: {
        default: {
          get: {
            pagination: 'cursor',
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {
          // '/api/v2/groups': {
          //   get: {
          //     pagination: 'none',
          //     queryArgs: { type: 'a' },
          //   },
          // },
        },
      },
    },
  },
})
