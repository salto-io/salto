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
import { Change, Element, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, WorkflowInstance } from './types'
import { WORKFLOW_TYPE_NAME } from '../../constants'

type TransitionValidator = {
    type: string
    configuration?: {
        [key: string]: string
    }
}

const removeValidatorsWithoutConfiguration = (instance: InstanceElement): InstanceElement => {
  for (const transition of instance.value.transitions) {
    transition.rules.validators = transition.rules.validators.filter((validator: TransitionValidator) => 'configuration' in validator)
  }
  return instance
}

const getWorkflowChanges = (changes: Change<Element>[]): Change<WorkflowInstance>[] => changes
  .filter(isInstanceChange)
  .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
  .filter(change => isWorkflowInstance(getChangeData(change)))


const filter: FilterCreator = () => ({
  preDeploy: async changes => {
    const relevantChanges = getWorkflowChanges(changes)
    relevantChanges
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .forEach(removeValidatorsWithoutConfiguration)
  },
})

export default filter
