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
import { CORE_ANNOTATIONS, Element, isElement } from '@salto-io/adapter-api'
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
      if (e.annotations[CORE_ANNOTATIONS.CHANGED_AT] === UNIX_TIME_ZERO_STRING) {
        delete e.annotations[CORE_ANNOTATIONS.CHANGED_AT]
        log.trace('Removed unix time 0 last modified of %s', await apiName(e))
      }
      if (e.annotations[CORE_ANNOTATIONS.CREATED_AT] === UNIX_TIME_ZERO_STRING) {
        delete e.annotations[CORE_ANNOTATIONS.CREATED_AT]
        log.trace('Removed unix time 0 create time of %s', await apiName(e))
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
