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
import { Element, ReferenceExpression, getChangeData, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PROJECT_TYPE } from '../constants'

/**
 * sorting project field contexts to avoid unnecessary noise
 */
const filter: FilterCreator = () => ({
  name: 'projectFieldContexts',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .filter(instance => instance.value.fieldContexts !== undefined)
      .forEach(instance => {
        instance.value.fieldContexts = _.sortBy(
          instance.value.fieldContexts,
          (ref: ReferenceExpression) => ref.elemID.getFullName()
        )
      })
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(element => element.elemID.typeName === PROJECT_TYPE)
      .filter(element => element.value.fieldContexts !== undefined)
      .forEach(element => {
        element.value.fieldContexts = _.sortBy(
          element.value.fieldContexts,
          (ref: ReferenceExpression) => ref.elemID.getFullName()
        )
      })
  },

})

export default filter
