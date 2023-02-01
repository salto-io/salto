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
import _ from 'lodash'
import { isInstanceElement, Element } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { API_DEFINITIONS_CONFIG } from '../config'

const log = logger(module)

// We can't omit inactive instances of those types because we need
//  all the instance in order to reorder them
const CAN_NOT_OMIT_INACTIVE_TYPE_NAMES = [
  'ticket_form',
]

/**
 * Omit inactive instances
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'omitInactiveFilter',
  onFetch: async (elements: Element[]) => {
    const shouldRemoveElement = (element: Element): boolean =>
      (isInstanceElement(element)
        && !CAN_NOT_OMIT_INACTIVE_TYPE_NAMES.includes(element.elemID.typeName)
        && config[API_DEFINITIONS_CONFIG]
          .types[element.elemID.typeName]?.transformation?.omitInactive === true
        && (element.elemID.typeName === 'webhook'
          ? element.value.status === 'inactive'
          : element.value.active === false))

    const elemFullNamesToOmit = elements
      .filter(shouldRemoveElement)
      .map(element => element.elemID.getFullName())
    if (elemFullNamesToOmit.length > 0) {
      log.debug('%d instances were omitted because they were inactive. IDs: %o',
        elemFullNamesToOmit.length, elemFullNamesToOmit)
    }
    _.remove(elements, shouldRemoveElement)
  },
})

export default filterCreator
