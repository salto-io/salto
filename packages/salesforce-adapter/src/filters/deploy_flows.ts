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
  Change, ElemID, getChangeData, InstanceElement, isAdditionChange,
  isInstanceChange,
  isModificationChange, toChange,
} from '@salto-io/adapter-api'
import _, { isUndefined } from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { RemoteFilterCreator } from '../filter'
import { isInstanceOfType } from './utils'
import { FLOW_METADATA_TYPE, SALESFORCE } from '../constants'
import { isActivatingChange, isActivatingChangeOnly, isActiveFlowChange } from '../change_validators/flows'

const { awu } = collections.asynciterable
const ACTIVE = 'Active'

const isRelevantChange = (change: Change<InstanceElement>): boolean => {
  if (isAdditionChange(change) && change.data.after.value.status === ACTIVE) {
    return true
  }
  if (isModificationChange(change)) {
    if (isActiveFlowChange(change) || (isActivatingChange(change) && !isActivatingChangeOnly(change))) {
      return true
    }
  }
  return false
}

const deactiveFlow = async (change: Change<InstanceElement>,
): Promise<Change<InstanceElement>> => {
  const after = getChangeData(change)
  const before = isAdditionChange(change) ? undefined : change.data.before
  const deactivatedAfter = after.clone()
  deactivatedAfter.value.status = 'Draft'
  return toChange({
    before,
    after: deactivatedAfter,
  })
}

const filterCreator: RemoteFilterCreator = ({ config, client }) => ({
  preDeploy: async changes => {
    const isSandbox = client.isSandbox()
    const flowSettings = await config.elementsSource.get(new ElemID(SALESFORCE, 'FlowSettings', 'instance'))
    const isEnableFlowDeployAsActiveEnabled = isUndefined(flowSettings)
    || isUndefined(flowSettings.value.enableFlowDeployAsActiveEnabled)
      ? true : flowSettings.value.enableFlowDeployAsActiveEnabled
    if (!isSandbox && !isEnableFlowDeployAsActiveEnabled) {
      const activeChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(change => isInstanceOfType(FLOW_METADATA_TYPE)(getChangeData(change)))
        .filter(isRelevantChange)
        .toArray()

      _.pullAll(changes, activeChanges)
      changes.push(...(await Promise.all(activeChanges.map(deactiveFlow))))
    }
  },
})

export default filterCreator
