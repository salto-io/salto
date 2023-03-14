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
import {
  ChangeError,
  getChangeData,
  ChangeValidator,
  isInstanceChange,
  InstanceElement,
  isModificationChange,
  ModificationChange,
  isAdditionChange, ElemID, DeployActions, Change, isRemovalChange, ReadOnlyElementsSource, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isEmpty, isUndefined } from 'lodash'
import { detailedCompare } from '@salto-io/adapter-utils'
import { FLOW_METADATA_TYPE, SALESFORCE } from '../constants'
import { isInstanceOfType } from '../filters/utils'
import { SalesforceConfig } from '../types'
import SalesforceClient from '../client/client'
import { FLOW_URL_SUFFIX } from '../elements_url_retreiver/lightining_url_resolvers'

const { awu } = collections.asynciterable
const ACTIVE = 'Active'
const PREFER_ACTIVE_FLOW_VERSIONS_DEFAULT = false
const ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT = false


const isFlowChange = (change: Change<InstanceElement>):
    Promise<boolean> => isInstanceOfType(FLOW_METADATA_TYPE)(getChangeData(change))

export const getDeployAsActiveFlag = async (elementsSource: ReadOnlyElementsSource | undefined, defaultValue: boolean)
    : Promise<boolean> => {
  const flowSettings = isUndefined(elementsSource)
    ? undefined : await elementsSource.get(new ElemID(SALESFORCE, 'FlowSettings', 'instance'))
  return isUndefined(flowSettings)
  || isUndefined(flowSettings.value.enableFlowDeployAsActiveEnabled)
    ? defaultValue : flowSettings.value.enableFlowDeployAsActiveEnabled
}

export const getFlowStatus = (instance: InstanceElement): string => instance.value.status

export const isActiveFlowChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  getFlowStatus(change.data.before) === ACTIVE && getFlowStatus(change.data.after) === ACTIVE
)

const isDeactivateChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  getFlowStatus(change.data.before) === ACTIVE && getFlowStatus(change.data.after) !== ACTIVE
)

export const isActivatingChange = (change: ModificationChange<InstanceElement>):
    boolean => (
  getFlowStatus(change.data.before) !== ACTIVE && getFlowStatus(change.data.after) === ACTIVE
)

const isDeactivationChangeOnly = (change: ModificationChange<InstanceElement>):
    boolean => {
  const afterClone = change.data.after.clone()
  afterClone.value.status = ACTIVE
  const diffWithoutStatus = detailedCompare(
    change.data.before,
    afterClone,
  )
  return isEmpty(diffWithoutStatus)
}

export const isActivatingChangeOnly = (change: ModificationChange<InstanceElement>):
    boolean => {
  const beforeClone = change.data.before.clone()
  beforeClone.value.status = ACTIVE
  const diffWithoutStatus = detailedCompare(
    beforeClone,
    change.data.after,
  )
  return isEmpty(diffWithoutStatus)
}

const testCoveragePostDeploy = (instance: InstanceElement): DeployActions => ({
  postAction: {
    title: 'Flows test coverage',
    subActions: [
      `Please make sure that activation of the new flow version was not blocked due to insufficient test coverage and manually activate it if needed. Flow name: ${instance.elemID.getFullName()}`,
    ],
  },
})

const deployAsInactivePostDeploy = (instance: InstanceElement, baseUrl?: URL): DeployActions => {
  const url = instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]
  if (url !== undefined) {
    return {
      postAction: {
        title: 'Deploying flows as inactive',
        description: 'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
        subActions: [
          `Go to: ${url}`,
          'Activate it by clicking “Activate”',
        ],
      },
    }
  }
  if (baseUrl !== undefined) {
    return {
      postAction: {
        title: 'Deploying flows as inactive',
        description: 'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
        subActions: [
          `Go to: ${baseUrl}${FLOW_URL_SUFFIX}`,
          `Search for the ${instance.elemID.getFullName()} flow and click on it`,
          'Activate it by clicking “Activate”',
        ],
      },
    }
  }
  return {
    postAction: {
      title: 'Deploying flows as inactive',
      description: 'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
      subActions: [
        'Go to the flow set up page in your org',
        `Search for the ${instance.elemID.getFullName()} flow and click on it`,
        'Activate it by clicking “Activate”',
      ],
    },
  }
}


const removeFlowError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Cannot delete flow',
  detailedMessage: `Cannot delete flow via metadata API. Flow name: ${instance.elemID.getFullName()}`,
})

const newVersionInfo = (instance: InstanceElement, active: boolean): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Info',
  message: `Deploying these changes will create a new ${active ? 'active' : 'inactive'} version of this flow`,
  detailedMessage: `Deploying these changes will create a new ${active ? 'active' : 'inactive'} version of this flow. Flow name: ${instance.elemID.getFullName()}`,
})

const inActiveNewVersionInfo = (instance: InstanceElement, preferActive: boolean): ChangeError => {
  if (preferActive) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Deploying these changes will create a new inactive version of this flow',
      detailedMessage: `Bear in mind that the new inactive version will not appear in Salto since your Salto environment is configured to prefer fetching active flow versions. Flow name: ${instance.elemID.getFullName()}`,
    }
  }
  return newVersionInfo(instance, false)
}

const deactivatingError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Deactivating a flow is not supported',
  detailedMessage: `Deactivating a flow is not supported via metadata API. Flow name: ${instance.elemID.getFullName()}`,
})

const activeFlowModificationError = (instance: InstanceElement, enableActiveDeploy: boolean, baseUrl?: URL):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Deploying these changes will create a new active version of this flow',
      detailedMessage: `Deploying these changes will create a new active version of this flow in case the test coverage percentage is greater than the number specified in your salesforce org config. Otherwise, a new inactive version of this flow will be created. Flow name: ${instance.elemID.getFullName()}`,
      deployActions: testCoveragePostDeploy(instance),
    }
  }
  return {
    ...newVersionInfo(instance, false),
    deployActions: deployAsInactivePostDeploy(instance, baseUrl),
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
      deployActions: testCoveragePostDeploy(instance),
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Your salesforce org is configured to disallow flow activations via the API',
    detailedMessage: `Your salesforce org is configured to disallow flow activations via the API. Flow name: ${instance.elemID.getFullName()}`,
  }
}

const activeFlowAdditionError = (instance: InstanceElement, enableActiveDeploy: boolean, baseUrl?: URL):
    ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Addition of a new active flow depends on test coverage',
      detailedMessage: '',
      deployActions: testCoveragePostDeploy(instance),
    }
  }
  return {
    ...newVersionInfo(instance, false),
    deployActions: deployAsInactivePostDeploy(instance, baseUrl),
  }
}

/**
 * Handling all changes regarding active flows
 */
const activeFlowValidator = (config: SalesforceConfig, isSandbox: boolean, client: SalesforceClient): ChangeValidator =>
  async (changes, elementsSource) => {
    const isPreferActiveVersion = config.fetch?.preferActiveFlowVersions
      ?? PREFER_ACTIVE_FLOW_VERSIONS_DEFAULT
    const isEnableFlowDeployAsActiveEnabled = await getDeployAsActiveFlag(
      elementsSource, ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT
    )
    const baseUrl = await client.getUrl()
    const flowChanges = await awu(changes)
      .filter(isInstanceChange)
      .filter(isFlowChange)
      .toArray()

    const removingFlowChangeErrors = flowChanges
      .filter(isRemovalChange)
      .map(change => removeFlowError(getChangeData(change)))

    const deactivatingFlowChangeErrors = flowChanges
      .filter(isModificationChange)
      .filter(isDeactivateChange)
      .map(change => {
        if (isDeactivationChangeOnly(change)) {
          return deactivatingError(getChangeData(change))
        }
        return inActiveNewVersionInfo(getChangeData(change), isPreferActiveVersion)
      })

    if (isSandbox) {
      const sandboxFlowModification = flowChanges
        .filter(isModificationChange)
        .filter(isActiveFlowChange)
        .map(getChangeData)
        .map(instance => newVersionInfo(instance, true))
      return [
        ...deactivatingFlowChangeErrors,
        ...sandboxFlowModification,
        ...removingFlowChangeErrors,
      ]
    }
    const activeFlowModification = flowChanges
      .filter(isModificationChange)
      .filter(isActiveFlowChange)
      .map(getChangeData)
      .map(flow => activeFlowModificationError(flow, isEnableFlowDeployAsActiveEnabled, baseUrl))

    const activatingFlow = flowChanges
      .filter(isModificationChange)
      .filter(isActivatingChange)
      .map(change => {
        if (isActivatingChangeOnly(change)) {
          return activatingFlowError(getChangeData(change), isEnableFlowDeployAsActiveEnabled)
        }
        return activeFlowModificationError(getChangeData(change), isEnableFlowDeployAsActiveEnabled, baseUrl)
      })

    const activeFlowAddition = flowChanges
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(flow => getFlowStatus(flow) === ACTIVE)
      .map(flow => activeFlowAdditionError(flow, isEnableFlowDeployAsActiveEnabled, baseUrl))

    return [...deactivatingFlowChangeErrors, ...activeFlowModification,
      ...activatingFlow, ...activeFlowAddition, ...removingFlowChangeErrors]
  }

export default activeFlowValidator
