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
import {
  ChangeError, getChangeData, ChangeValidator, ChangeDataType,
  isInstanceChange, InstanceElement, isModificationChange, ModificationChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FLOW_METADATA_TYPE } from '../constants'
import { isInstanceOfType } from '../filters/utils'

const { awu } = collections.asynciterable
const ACTIVE = 'Active'

const isFlowTypeChange = (changedElement: ChangeDataType): Promise<boolean> => (
  isInstanceOfType(FLOW_METADATA_TYPE)(changedElement)
)

const isActiveFlow = (instance: InstanceElement): boolean => (
  instance.value.status === ACTIVE
)

const isActiveFlowChange = async (change: ModificationChange<InstanceElement>):
    Promise<boolean> => (
  await isFlowTypeChange(change.data.before) && isActiveFlow(change.data.before)
)

const createChangeError = (instance: InstanceElement): ChangeError => {
  if (instance.value.status === ACTIVE) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'When editing an active flow, a new version of the flow will be created',
      detailedMessage: `When editing an active flow, a new version of the flow will be created and the previous one will be deactivated. Flow name: ${instance.elemID.getFullName()}`,
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot deactivate active flows via Salto',
    detailedMessage: `You cannot deactivate active flows via Salto. Flow name: ${instance.elemID.getFullName()}`,
  }
}


/**
 * Handling active flows changes
 */
const changeValidator: ChangeValidator = async changes => awu(changes)
  .filter(isInstanceChange)
  .filter(isModificationChange)
  .filter(isActiveFlowChange)
  .map(getChangeData)
  .map(createChangeError)
  .toArray()

export default changeValidator
