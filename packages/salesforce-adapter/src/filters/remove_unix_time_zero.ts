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
import { Element, isElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'

const { awu } = collections.asynciterable

const log = logger(module)

const UNIX_TIME_ZERO_STRING = '1970-01-01T00:00:00.000Z'

const removeUnixTimeZero = async (
  elements: Element[],
): Promise<void> => {
  await awu(elements)
    .filter(isElement)
    .forEach(async e => {
      // eslint-disable-next-line no-underscore-dangle
      if (e.annotations._changed_at === UNIX_TIME_ZERO_STRING) {
        // eslint-disable-next-line no-underscore-dangle
        delete e.annotations._changed_at
        log.debug(`Removed unix time 0 last modified of ${await apiName(e)}`)
      }
      // eslint-disable-next-line no-underscore-dangle
      if (e.annotations._created_at === UNIX_TIME_ZERO_STRING) {
        // eslint-disable-next-line no-underscore-dangle
        delete e.annotations._created_at
        log.debug(`Removed unix time 0 create time of ${await apiName(e)}`)
      }
    })
}

/**
 * Replace specific field values that are fetched as ids, to their names.
 */
const filter: LocalFilterCreator = () => ({
  name: 'removeUnixTimeZero',
  onFetch: async (elements: Element[]) => {
    await removeUnixTimeZero(elements)
  },
})

export default filter
