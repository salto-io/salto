/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements, definitions } from '@salto-io/adapter-components'
import { FetchCriteria } from './definitions/types'

type UserFetchConfig = definitions.UserFetchConfig<{
  customNameMappingOptions: never
  fetchCriteria: FetchCriteria
}> & { managePagesForSpaces?: string[] }

export type UserConfig = definitions.UserConfig<
  never,
  definitions.ClientBaseConfig<definitions.ClientRateLimitConfig>,
  UserFetchConfig,
  definitions.UserDeployConfig
>

export const DEFAULT_CONFIG: UserConfig = {
  fetch: {
    include: elements.query.INCLUDE_ALL_CONFIG.include,
    exclude: [
      {
        type: 'space',
        criteria: {
          status: 'archived',
        },
      },
      {
        type: 'space',
        criteria: {
          type: 'personal',
        },
      },
    ],
    hideTypes: true,
    managePagesForSpaces: [],
  },
}
