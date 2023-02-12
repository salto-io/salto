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
import { Element, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { PROJECT_COMPONENT_TYPE, PROJECT_TYPE } from '../constants'

/**
 * Remove archived project components
 */
const filter: FilterCreator = () => ({
  name: 'archivedProjectComponentsFilter',
  onFetch: async (elements: Element[]) => {
    const removedComponents = _.remove(
      elements,
      element => isInstanceElement(element)
        && element.elemID.typeName === PROJECT_COMPONENT_TYPE
        && element.value.archived
    )

    const removedComponentsIds = new Set(removedComponents.map(instance => instance.elemID.getFullName()))

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .forEach(instance => {
        _.remove(
          instance.value.components,
          ref => isReferenceExpression(ref) && removedComponentsIds.has(ref.elemID.getFullName())
        )
      })

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_COMPONENT_TYPE)
      .forEach(instance => {
        delete instance.value.archived
      })
  },
})

export default filter
