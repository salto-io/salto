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
import { getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, Transition } from './types'


// This filter removes circular transitions that cannot be deployed
const filter: FilterCreator = () => {
  const cache: Map<string, Transition[]> = new Map()
  return {
    name: 'circularTransitionsFilter',
    preDeploy: async changes => {
      changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isWorkflowInstance)
        .forEach(instance => {
          const noCircularTransitions = instance.value.transitions
            .filter(transition => transition.to !== '' || transition.from !== undefined)
          if (instance.value.transitions.length !== noCircularTransitions.length) {
            cache.set(instance.elemID.getFullName(), instance.value.transitions)
            instance.value.transitions = noCircularTransitions
          }
        })
    },
    onDeploy: async changes => {
      changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isWorkflowInstance)
        .forEach(instance => {
          instance.value.transitions = cache.get(instance.elemID.getFullName()) ?? instance.value.transitions
        })
    },
  }
}
export default filter
