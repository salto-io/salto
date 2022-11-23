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
  isAdditionChange, AdditionChange, ElemID, DeployActions,
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

const newVersionInfo = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Info',
  message: 'Deploying these changes will create a new active version of this flow',
  detailedMessage: `Deploying these changes will create a new active version of this flow. Flow name: ${instance.elemID.getFullName()}`,
})

const inActiveNewVersionInfo = (instance: InstanceElement, preferActive: boolean): ChangeError => {
  if (preferActive) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Deploying these changes will create a new inactive version of this flow',
      detailedMessage: `Deploying these changes will create a new inactive version of this flow. Flow name: ${instance.elemID.getFullName()}`,
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Info',
    message: ' Deploying these changes will create a new inactive version of this flow',
    detailedMessage: `Bear in mind that the new inactive version will not appear in Salto since your Salto environment is configured to prefer fetching active flow versions. Flow name: ${instance.elemID.getFullName()}`,
  }
}

const deactivatingError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Deactivating a flow not supported',
  detailedMessage: `Deactivating a flow not supported via metadata API. Flow name: ${instance.elemID.getFullName()}`,
})

const testCoveragePostDeploy = (): DeployActions => ({
  postAction: {
    title: 'Flows test coverage',
    subActions: [
      'Please make sure that activation of the new flow version was not blocked due to insufficient test coverage and manually activate it if needed.',
    ],
  },
})

const activeFlowModificationError = (instance: InstanceElement, enableActiveDeploy: boolean):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Deploying these changes will create a new active version of this flow',
      detailedMessage: `Deploying these changes will create a new active version of this flow in case the test coverage percentage is greater than the number specified in your salesforce org config. Otherwise, a new inactive version of this flow will be created. Flow name: ${instance.elemID.getFullName()}`,
      deployActions: testCoveragePostDeploy(),
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Info',
    message: 'Your salesforce org is configured to disallow modifications to active flows',
    detailedMessage: `Your salesforce org is configured to disallow modifications to active flows. Therefore, deploying these changes will create a new inactive version that will need to be activated manually.. Flow name: ${instance.elemID.getFullName()}`,
  }
}

const activatingFlowError = (instance: InstanceElement, enableActiveDeploy: boolean):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Activating this flow will work in case of sufficient test coverage as defined in your salesforce org config',
      detailedMessage: `Activating this flow will work in case of sufficient test coverage as defined in your salesforce org config. Flow name: ${instance.elemID.getFullName()}`,
      deployActions: testCoveragePostDeploy(),
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Your salesforce org is configured to disallow flow activations via the API',
    detailedMessage: `Your salesforce org is configured to disallow flow activations via the API. Flow name: ${instance.elemID.getFullName()}`,
  }
}

const activeFlowAdditionError = (instance: InstanceElement, enableActiveDeploy: boolean):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Addition of a new active flow depends on test coverage',
      detailedMessage: '',
      deployActions: testCoveragePostDeploy(),
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Your salesforce org is configured to disallow creation of active flows',
    detailedMessage: `Your salesforce org is configured to disallow creation of active flows. Please update the flow status to ‘DRAFT’ and manually activate it after deploying a new inactive version.. Flow name: ${instance.elemID.getFullName()}`,
  }
}

/**
 * Handling addition and modification regarding active flows
 */
const activeFlowValidator = (config: SalesforceConfig, isSandbox: boolean): ChangeValidator =>
  async (changes, elementsSource) => {
    const flowSettings = isUndefined(elementsSource)
      ? undefined : await elementsSource.get(new ElemID(SALESFORCE, 'FlowSettings', 'instance'))
    // TODO: change to preferActiveFlowVersions
    const isPreferActiveVersion = config.fetch?.fetchAllCustomSettings ?? false
    const isEnableFlowDeployAsActiveEnabled = isUndefined(flowSettings)
      ? false : flowSettings.value.enableFlowDeployAsActiveEnabled
    const flowChanges = await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(isFlowChange)
      .toArray()

    const deactivatingFlowChangeErrors = flowChanges
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
      return [...deactivatingFlowChangeErrors, ...sandboxFlowModification]
    }
    const activeFlowModification = flowChanges
      .filter(isModificationChange)
      .filter(isActiveFlowChange)
      .map(getChangeData)
      .map(flow => activeFlowModificationError(flow, isEnableFlowDeployAsActiveEnabled))

    const activatingFlow = flowChanges
      .filter(isModificationChange)
      .filter(isActivatingChange)
      .map(getChangeData)
      .map(flow => activatingFlowError(flow, isEnableFlowDeployAsActiveEnabled))

    const activeFlowAddition = flowChanges
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(flow => flow.value.status === ACTIVE)
      .map(flow => activeFlowAdditionError(flow, isEnableFlowDeployAsActiveEnabled))

    return [...deactivatingFlowChangeErrors, ...activeFlowModification,
      ...activatingFlow, ...activeFlowAddition]
  }

export default activeFlowValidator
