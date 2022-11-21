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
  ChangeError,
  getChangeData,
  ChangeValidator,
  isInstanceChange,
  InstanceElement,
  isModificationChange,
  ModificationChange,
  isAdditionOrModificationChange,
  isAdditionChange, AdditionChange, ElemID,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isEmpty, isUndefined } from 'lodash'
import { detailedCompare } from '@salto-io/adapter-utils'
import { FLOW_METADATA_TYPE, SALESFORCE } from '../constants'
import { isInstanceOfType } from '../filters/utils'
import { SalesforceConfig } from '../types'

const { awu } = collections.asynciterable
const ACTIVE = 'Active'

const isFlowChange = (change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)
    : Promise<boolean> => isInstanceOfType(FLOW_METADATA_TYPE)(getChangeData(change))

const isActiveFlowChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  change.data.before.value.status === ACTIVE && change.data.after.value.status === ACTIVE
)

const isDeactivateChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  change.data.before.value.status === ACTIVE && change.data.after.value.status !== ACTIVE
)

const isActivatingChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  change.data.before.value.status !== ACTIVE && change.data.after.value.status === ACTIVE
)

const isStatusChangeOnly = (change: ModificationChange<InstanceElement>):
    boolean => {
  const afterClone = change.data.after.clone()
  afterClone.value.status = ACTIVE
  const diffWithoutStatus = detailedCompare(
    change.data.before,
    afterClone,
  )
  return isEmpty(diffWithoutStatus)
}

const inActiveNewVersionInfo = (instance: InstanceElement, preferActive: boolean): ChangeError => {
  if (preferActive) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'When editing an active flow, a new version of the flow will be created',
      detailedMessage: `When editing an active flow, a new version of the flow will be created and the previous one will be deactivated. Flow name: ${instance.elemID.getFullName()}`,
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Info',
    message: ' deactivate active flows',
    detailedMessage: `You cannot deactivate active flows via Salto. Flow name: ${instance.elemID.getFullName()}`,
  }
}

const deactivatingError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Cannot delete flow',
  detailedMessage: `Cannot delete flow via metadata API. Flow name: ${instance.elemID.getFullName()}`,
})

const newVersionInfo = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Info',
  message: 'When editing an active flow, a new version of the flow will be created',
  detailedMessage: `A new version of the flow will be created as active and the previous one will be deactivated. Flow name: ${instance.elemID.getFullName()}`,
})

const activeFlowModificationError = (instance: InstanceElement, enableActiveDeploy: boolean):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'When editing an active flow, a new version of the flow will be created',
      detailedMessage: `When editing an active flow, a new version of the flow will be created and the previous one will be deactivated. Flow name: ${instance.elemID.getFullName()}`,
      deployActions: {
        postAction: {
          title: 'Re-enable CPQ Triggers',
          description: 'CPQ triggers should now be re-enabled:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
          ],
        },
      },
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Info',
    message: 'Cannot deactivate active flows via Salto',
    detailedMessage: `You cannot deactivate active flows via Salto. Flow name: ${instance.elemID.getFullName()}`,
  }
}

const activatingFlowError = (instance: InstanceElement, enableActiveDeploy: boolean):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'When editing adfn active flow, a new version of the flow will be created',
      detailedMessage: `When editing an active flow, a new version of the flow will be created and the previous one will be deactivated. Flow name: ${instance.elemID.getFullName()}`,
      deployActions: {
        postAction: {
          title: 'Re-enable CPQ Triggers',
          description: 'CPQ triggers should now be re-enabled:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
          ],
        },
      },
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot deactivate active flows via Salto',
    detailedMessage: `You cannot deactivate active flows via Salto. Flow name: ${instance.elemID.getFullName()}`,
  }
}

const activeFlowAdditionError = (instance: InstanceElement, enableActiveDeploy: boolean):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'When editing an actasive flow, a new version of the flow will be created',
      detailedMessage: '',
      deployActions: {
        postAction: {
          title: 'Re-enable CPQ Triggers',
          description: 'CPQ triggers should now be re-enabled:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
          ],
        },
      },
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
 * Handling addition and modification regarding active flows
 */
const activeFlowValidator = (config: SalesforceConfig, isSandbox: boolean): ChangeValidator =>
  async (changes, elementsSource) => {
    let flowSetting
    // TODO: change to preferActiveFlowVersions
    const isPreferActiveVersion = config.enumFieldPermissions ?? false
    if (!isUndefined(elementsSource)) {
      flowSetting = await elementsSource.get(new ElemID(SALESFORCE, 'FlowSettings', 'instance'))
    }
    const isActiveDeployEnabled = isUndefined(flowSetting)
      ? false : flowSetting.value.enableFlowDeployAsActiveEnabled
    const flowChanges = await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(isFlowChange)
      .toArray()

    const deactivateFlows = flowChanges
      .filter(isModificationChange)
      .filter(isDeactivateChange)
      .map(change => {
        if (isStatusChangeOnly(change)) {
          return deactivatingError(getChangeData(change))
        }
        return inActiveNewVersionInfo(getChangeData(change), isPreferActiveVersion)
      })

    if (isSandbox) {
      const sandboxFlowModification = flowChanges
        .filter(isModificationChange)
        .filter(isActiveFlowChange)
        .map(getChangeData)
        .map(newVersionInfo)
      return [...deactivateFlows, ...sandboxFlowModification]
    }
    const activeFlowModification = flowChanges
      .filter(isModificationChange)
      .filter(isActiveFlowChange)
      .map(getChangeData)
      .map(flow => activeFlowModificationError(flow, isActiveDeployEnabled))

    const activatingFlow = flowChanges
      .filter(isModificationChange)
      .filter(isActivatingChange)
      .map(getChangeData)
      .map(flow => activatingFlowError(flow, isActiveDeployEnabled))

    const activeFlowAddition = flowChanges
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(flow => flow.value.status === ACTIVE)
      .map(flow => activeFlowAdditionError(flow, isActiveDeployEnabled))

    return [...deactivateFlows, ...activeFlowModification, ...activatingFlow, ...activeFlowAddition]
  }

export default activeFlowValidator
