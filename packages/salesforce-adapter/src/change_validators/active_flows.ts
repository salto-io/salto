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
  isAdditionChange, AdditionChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { config } from '@salto-io/logging/dist/src/internal/env'
import { FLOW_METADATA_TYPE } from '../constants'
import { isInstanceOfType } from '../filters/utils'
import { SalesforceConfig } from '../types'

const { awu } = collections.asynciterable
const ACTIVE = 'Active'

const isFlowChange = (change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>)
    : Promise<boolean> => isInstanceOfType(FLOW_METADATA_TYPE)(getChangeData(change))

const isActiveFlowChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  change.data.before.value.status === ACTIVE && change.data.before.value.status === ACTIVE
)

const isDeactivateChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  change.data.before.value.status === ACTIVE && change.data.before.value.status !== ACTIVE
)

const isActivatingChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  change.data.before.value.status !== ACTIVE && change.data.before.value.status === ACTIVE
)

const isNonStatusChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  change.data.before.value.status !== ACTIVE && change.data.before.value.status === ACTIVE
)

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
    message: 'Cannot deactivate active flows via Salto',
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
        preAction: {
          title: 'Disable CPQ Triggers',
          description: 'CPQ triggers should be disabled before deploying:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
            'Check the "Triggers Disabled" checkbox',
            'Click "Save"',
          ],
        },
        postAction: {
          title: 'Re-enable CPQ Triggers',
          description: 'CPQ triggers should now be re-enabled:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
            'Uncheck the "Triggers Disabled" checkbox',
            'Click "Save"',
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
      message: 'When editing an active flow, a new version of the flow will be created',
      detailedMessage: `When editing an active flow, a new version of the flow will be created and the previous one will be deactivated. Flow name: ${instance.elemID.getFullName()}`,
      deployActions: {
        preAction: {
          title: 'Disable CPQ Triggers',
          description: 'CPQ triggers should be disabled before deploying:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
            'Check the "Triggers Disabled" checkbox',
            'Click "Save"',
          ],
        },
        postAction: {
          title: 'Re-enable CPQ Triggers',
          description: 'CPQ triggers should now be re-enabled:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
            'Uncheck the "Triggers Disabled" checkbox',
            'Click "Save"',
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
      message: 'When editing an active flow, a new version of the flow will be created',
      detailedMessage: `When editing an active flow, a new version of the flow will be created and the previous one will be deactivated. Flow name: ${instance.elemID.getFullName()}`,
      deployActions: {
        preAction: {
          title: 'Disable CPQ Triggers',
          description: 'CPQ triggers should be disabled before deploying:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
            'Check the "Triggers Disabled" checkbox',
            'Click "Save"',
          ],
        },
        postAction: {
          title: 'Re-enable CPQ Triggers',
          description: 'CPQ triggers should now be re-enabled:',
          subActions: [
            'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
            'Uncheck the "Triggers Disabled" checkbox',
            'Click "Save"',
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
  async (changes, elementSource) => {
    const isSandbox = false
    const isActiveDeployEnabled = false
    const isPreferActiveVersion = false
    // const flowSetting = elementSource
    const flowChanges = await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(isFlowChange)
      .toArray()

    const deactivateFlows = flowChanges
      .filter(isModificationChange)
      .filter(isDeactivateChange)
      .map(change => {
        if (isNonStatusChange(change)) {
          return inActiveNewVersionInfo(getChangeData(change), isPreferActiveVersion)
        }
        return deactivatingError(getChangeData(change))
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

export default changeValidator
