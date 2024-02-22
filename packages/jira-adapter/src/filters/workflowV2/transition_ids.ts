/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { isWorkflowV2Instance, WorkflowV2Instance } from './types'

const getMaxTransitionId = (workflowInstance: WorkflowV2Instance): number =>
  _.toSafeInteger(
    _.maxBy(Object.values(workflowInstance.value.transitions), transition => _.toSafeInteger(transition.id))?.id,
  )

const addTransitionIds = (workflowInstance: WorkflowV2Instance): void => {
  let maxTransitionId = getMaxTransitionId(workflowInstance)
  Object.values(workflowInstance.value.transitions).forEach(transition => {
    if (transition.id === undefined) {
      transition.id = _.toString(maxTransitionId + 1)
      maxTransitionId += 1
    }
  })
}

const filter: FilterCreator = () => ({
  name: 'transitionIdsFilter',
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isWorkflowV2Instance)
      .forEach(addTransitionIds)
  },
})

export default filter
