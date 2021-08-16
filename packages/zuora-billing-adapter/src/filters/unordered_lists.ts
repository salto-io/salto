/*
*                      Copyright 2021 Salto Labs Ltd.
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
import {
  Element, isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { SETTINGS_TYPE_PREFIX } from '../constants'

/**
 * Sort lists whose order changes between fetches, to avoid unneeded noise.
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const roleInstances = (elements
      .filter(isInstanceElement)
      .filter(e => e.refType.elemID.name === `${SETTINGS_TYPE_PREFIX}Role`))

    roleInstances.forEach(role => {
      if (Array.isArray(role.value.attributes)) {
        role.value.attributes = _.sortBy(
          role.value.attributes,
          attr => [attr.scope, attr.name, attr.activationLevel],
        )
      }
    })
  },
})

export default filterCreator
