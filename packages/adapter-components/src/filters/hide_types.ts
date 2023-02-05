/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { Element, isObjectType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { UserFetchConfig } from '../config'
import { FilterCreator } from '../filter_utils'


/**
 * Hide types if needed according to configuration.
 * Note: This should apply only to hard-coded types - it is the adapter's responsibility to ensure this.
 */
export const hideTypesFilterCreator: <
 TClient,
 TContext extends { fetch: Pick<UserFetchConfig, 'hideTypes'> },
 TResult extends void | filter.FilterResult = void,
> () => FilterCreator<TClient, TContext, TResult> = (
) => ({ config }) => ({
  name: 'hideTypes',
  onFetch: async (elements: Element[]) => {
    if (config.fetch.hideTypes) {
      elements
        .filter(isObjectType)
        .forEach(objType => {
          objType.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        })
    }
  },
})
