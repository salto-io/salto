/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { PROJECT_COMPONENT_TYPE, PROJECT_TYPE } from '../constants'

/**
 * Remove archived projects and project components
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    _.remove(
      elements,
      element => isInstanceElement(element)
        && [PROJECT_COMPONENT_TYPE, PROJECT_TYPE].includes(element.elemID.typeName)
        && element.value.archived
    )

    elements
      .filter(isInstanceElement)
      .filter(instance => [PROJECT_COMPONENT_TYPE, PROJECT_TYPE].includes(instance.elemID.typeName))
      .forEach(instance => {
        delete instance.value.archived
      })
  },
})

export default filter
