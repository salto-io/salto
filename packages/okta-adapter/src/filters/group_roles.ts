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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME } from '../constants'

/**
 * Delete roles field from Group type
 */
const filter: FilterCreator = () => ({
  name: 'groupRolesFilter',
  onFetch: async (elements: Element[]) => {
    const groups = elements.filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME)
    groups.forEach(group => delete group.value.roles)
  },
})

export default filter
