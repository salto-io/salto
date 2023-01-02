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
  Change, getChangeData, InstanceElement, isAdditionChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { RemoteFilterCreator } from '../filter'
import { isInstanceOfType } from './utils'
import { FLOW_METADATA_TYPE } from '../constants'
import {
  getDeployAsActiveFlag,
  getFlowStatus,
  isActivatingChange,
  isActivatingChangeOnly,
  isActiveFlowChange,
} from '../change_validators/flows'

const { awu } = collections.asynciterable
const ACTIVE = 'Active'
const ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT = true

const isRelevantChange = (change: Change<InstanceElement>): boolean => {
  if (isAdditionChange(change) && getFlowStatus(change.data.after) === ACTIVE) {
    return true
  }
  if (isModificationChange(change)
    && (
      isActiveFlowChange(change)
      // if the change is activating only it supposed to be caught in the CV
      || (isActivatingChange(change) && !isActivatingChangeOnly(change)))) {
    return true
  }

  return false
}

const filterCreator: RemoteFilterCreator = ({ config, client }) => ({
  preDeploy: async changes => {
    const isSandbox = client.isSandbox()
    const isEnableFlowDeployAsActiveEnabled = await getDeployAsActiveFlag(
      config.elementsSource, ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT
    )
    if (!isSandbox && !isEnableFlowDeployAsActiveEnabled) {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => isInstanceOfType(FLOW_METADATA_TYPE)(getChangeData(change)))
        .filter(isRelevantChange)
        .forEach(change => { getChangeData(change).value.status = 'Draft' })
    }
  },
})

export default filterCreator
