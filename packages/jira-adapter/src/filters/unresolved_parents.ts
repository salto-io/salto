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
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const log = logger(module)

/**
 * Filter to remove instances with unresolved parents
 * (can happen if we remove an instance in the duplicate_ids filter)
 */
const filter: FilterCreator = () => ({
  name: 'unresolvedParentsFilter',
  onFetch: async elements => {
    const ids = new Set(
      elements.map(instance => instance.elemID.getFullName())
    )
    const removedChildren = _.remove(
      elements,
      element => isInstanceElement(element)
        && getParents(element).some(parent => !ids.has(parent.elemID.getFullName()))
    )

    if (removedChildren.length > 0) {
      log.warn(`Removed instances with unresolved parents: ${removedChildren.map(instance => instance.elemID.getFullName()).join(', ')}`)
    }
  },
})

export default filter
