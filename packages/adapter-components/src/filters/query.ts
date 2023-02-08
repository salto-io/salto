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
import { isInstanceElement } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter_utils'
import { ElementQuery } from '../elements/query'

const log = logger(module)

/**
 * A filter to filter out instances by the fetchQuery of the adapter
 */
export const queryFilterCreator: <
  TClient,
  TContext,
  TResult extends void | filter.FilterResult,
  TAdditional extends { fetchQuery: ElementQuery }
>() => FilterCreator<TClient, TContext, TResult, TAdditional> = () => ({ fetchQuery }) => ({
  name: 'queryFilter',
  onFetch: async elements => {
    const removedInstances = _.remove(
      elements,
      element => isInstanceElement(element) && !fetchQuery.isInstanceMatch(element)
    )

    if (removedInstances.length > 0) {
      log.debug(`Omitted ${removedInstances.length} instances that did not match the fetch criteria. The first 100 ids that were removed are: ${removedInstances.slice(0, 100).map(e => e.elemID.getFullName()).join(', ')}`)
    }
  },
})
