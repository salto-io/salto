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
import { getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'

function removeCircularTransitions(value: InstanceElement): void {
  value.value.transitions = value.value.transitions
    .filter((transition: Value) => transition.to !== '' || transition.from !== undefined)
}

// This filter removes circular transitions that cannot be deployed
const filter: FilterCreator = () => ({
  name: 'circularTransitionsFilter',
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(instance => _.isArray(instance.value.transitions))
      .forEach(removeCircularTransitions)
  },
  // onDeploy: async changes => {
  // },
})
export default filter
