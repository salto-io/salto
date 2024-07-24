/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { Options } from '../types'

const log = logger(module)

export const PAGINATION: definitions.ApiDefinitions<Options>['pagination'] = {
  increasePageUntilEmpty: {
    funcCreator:
      () =>
      ({ responseData, currentParams }) => {
        if (!('results' in responseData)) {
          log.error('increasePageUntilEmpty pagination error: No results in response data')
          return []
        }
        const { results } = responseData
        if (!Array.isArray(results)) {
          log.error('increasePageUntilEmpty pagination error: Results is not an array')
          return []
        }
        if (results.length === 0) {
          return []
        }
        return [
          _.merge({}, currentParams, {
            queryParams: {
              page: (Number(currentParams.queryParams?.page ?? 0) + 1).toString(),
            },
          }),
        ]
      },
  },
}
