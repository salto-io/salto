/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isObjectType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { UserFetchConfig, UserFetchConfigOptions } from '../definitions/user'
import { UserConfigAdapterFilterCreator } from '../filter_utils'

/**
 * Hide types if needed according to configuration.
 * Note: This should apply only to hard-coded types - it is the adapter's responsibility to ensure this.
 */
export const hideTypesFilterCreator: <
  TOptions extends UserFetchConfigOptions,
  TContext extends { fetch: Pick<UserFetchConfig<TOptions>, 'hideTypes'> },
  TResult extends void | filter.FilterResult = void,
>() => UserConfigAdapterFilterCreator<TContext, TResult> =
  () =>
  ({ config }) => ({
    name: 'hideTypes',
    onFetch: async (elements: Element[]) => {
      if (config.fetch.hideTypes) {
        elements.filter(isObjectType).forEach(objType => {
          objType.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        })
      }
    },
  })
