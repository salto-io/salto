/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  CORE_ANNOTATIONS,
  DeployActions,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isModificationChange,
  isRemovalChange,
  ModificationChange,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import _, { isEmpty, isUndefined } from 'lodash'
import { detailedCompare } from '@salto-io/adapter-utils'
import { ACTIVE, FLOW_METADATA_TYPE, INVALID_DRAFT, SALESFORCE, STATUS } from '../constants'
import {
  apiNameSync,
  isDeactivatedFlowChange,
  isDeactivatedFlowChangeOnly,
  isInstanceOfTypeChangeSync,
} from '../filters/utils'
import { FetchProfile } from '../types'
import SalesforceClient from '../client/client'
import { FLOW_URL_SUFFIX } from '../elements_url_retriever/lightning_url_resolvers'

const ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT = false

const getDeployAsActiveFlag = async (
  elementsSource: ReadOnlyElementsSource | undefined,
  defaultValue: boolean,
): Promise<boolean> => {
  const flowSettings = isUndefined(elementsSource)
    ? undefined
    : await elementsSource.get(new ElemID(SALESFORCE, 'FlowSettings', 'instance'))
  return isUndefined(flowSettings) || isUndefined(flowSettings.value.enableFlowDeployAsActiveEnabled)
    ? defaultValue
    : flowSettings.value.enableFlowDeployAsActiveEnabled
}

const getFlowStatus = (instance: InstanceElement): string => instance.value[STATUS]

const isActiveFlowChange = (change: ModificationChange<InstanceElement>): boolean =>
  getFlowStatus(change.data.before) === ACTIVE && getFlowStatus(change.data.after) === ACTIVE

const isActivatingChange = (change: ModificationChange<InstanceElement>): boolean =>
  getFlowStatus(change.data.before) !== ACTIVE && getFlowStatus(change.data.after) === ACTIVE

const isActivatingChangeOnly = (change: ModificationChange<InstanceElement>): boolean => {
  const beforeClone = change.data.before.clone()
  beforeClone.value[STATUS] = ACTIVE
  const diffWithoutStatus = detailedCompare(beforeClone, change.data.after)
  return isEmpty(diffWithoutStatus)
}

const testCoveragePostDeploy = (instance: InstanceElement): DeployActions => ({
  postAction: {
    title: 'Flows test coverage',
    showOnFailure: false,
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
        description:
          'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
        showOnFailure: false,
        subActions: [`Go to: ${url}`, 'Activate it by clicking “Activate”'],
      },
    }
  }
  if (baseUrl !== undefined) {
    return {
      postAction: {
        title: 'Deploying flows as inactive',
        description:
          'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
        showOnFailure: false,
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
      description:
        'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
      showOnFailure: false,
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
  detailedMessage: `Cannot delete flow via metadata API. Flow name: ${instance.elemID.getFullName()}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/7936713-cannot-delete-flow`,
})

const newVersionInfo = (instance: InstanceElement, active: boolean): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Info',
  message: `Deploying these changes will create a new ${active ? 'active' : 'inactive'} version of this flow`,
  detailedMessage: `Deploying these changes will create a new ${active ? 'active' : 'inactive'} version of this flow. Flow name: ${instance.elemID.getFullName()}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows`,
})

const inActiveNewVersionInfo = (instance: InstanceElement, preferActive: boolean): ChangeError => {
  if (preferActive) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Deploying these changes will create a new inactive version of this flow',
      detailedMessage: `Bear in mind that the new inactive version will not appear in Salto since your Salto environment is configured to prefer fetching active flow versions. Flow name: ${instance.elemID.getFullName()}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows`,
    }
  }
  return newVersionInfo(instance, false)
}

const activeFlowModificationError = (
  instance: InstanceElement,
  enableActiveDeploy: boolean,
  baseUrl?: URL,
): ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Deploying these changes will create a new active version of this flow',
      detailedMessage: `Deploying these changes will create a new active version of this flow in case the test coverage percentage is greater than the number specified in your salesforce org config. Otherwise, a new inactive version of this flow will be created. Flow name: ${instance.elemID.getFullName()}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows`,
      deployActions: testCoveragePostDeploy(instance),
    }
  }
  return {
    ...newVersionInfo(instance, false),
    deployActions: deployAsInactivePostDeploy(instance, baseUrl),
  }
}

const activatingFlowError = (instance: InstanceElement, enableActiveDeploy: boolean): ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message:
        'Activating this flow will work in case of sufficient test coverage as defined in your salesforce org config',
      detailedMessage: `Activating this flow will work in case of sufficient test coverage as defined in your salesforce org config. Flow name: ${instance.elemID.getFullName()}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows`,
      deployActions: testCoveragePostDeploy(instance),
    }
  }
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Your salesforce org is configured to disallow flow activations via the API',
    detailedMessage: `Your salesforce org is configured to disallow flow activations via the API. Flow name: ${instance.elemID.getFullName()}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows`,
  }
}

const activeFlowAdditionError = (
  instance: InstanceElement,
  enableActiveDeploy: boolean,
  baseUrl?: URL,
): ChangeError => {
  if (enableActiveDeploy) {
    return {
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Addition of a new active flow depends on test coverage',
      detailedMessage:
        'You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows',
      deployActions: testCoveragePostDeploy(instance),
    }
  }
  return {
    ...newVersionInfo(instance, false),
    deployActions: deployAsInactivePostDeploy(instance, baseUrl),
  }
}

const createDeactivatedFlowChangeInfo = (flowInstance: InstanceElement): ChangeError => ({
  elemID: flowInstance.elemID,
  severity: 'Info',
  message: 'Flow will be deactivated',
  detailedMessage: `The Flow ${apiNameSync(flowInstance)} will be deactivated.`,
})

const activateInvalidFlowError = (flowInstance: InstanceElement): ChangeError => ({
  elemID: flowInstance.elemID,
  severity: 'Error',
  message: 'Cannot activate an Invalid Flow',
  detailedMessage: `The Flow ${apiNameSync(flowInstance)} is invalid. Please review the errors at ${'https://help.salesforce.com/s/articleView?id=platform.flow.htm&type=5'} `,
})

/**
 * Handling all changes regarding active flows
 */
const activeFlowValidator =
  (fetchProfile: FetchProfile, isSandbox: boolean, client: SalesforceClient): ChangeValidator =>
  async (changes, elementsSource) => {
    const isPreferActiveVersion = fetchProfile.preferActiveFlowVersions
    const isEnableFlowDeployAsActiveEnabled = await getDeployAsActiveFlag(
      elementsSource,
      ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT,
    )
    const baseUrl = await client.getUrl()
    const flowChanges = changes.filter(isInstanceOfTypeChangeSync(FLOW_METADATA_TYPE))

    const removingFlowChangeErrors = flowChanges
      .filter(isRemovalChange)
      .map(change => removeFlowError(getChangeData(change)))

    const [deactivatedFlowOnlyChanges, deactivatedFlowChanges] = _.partition(
      flowChanges.filter(isDeactivatedFlowChange),
      isDeactivatedFlowChangeOnly,
    )

    const inactiveNewVersionChangeInfo = deactivatedFlowChanges.map(change =>
      inActiveNewVersionInfo(getChangeData(change), isPreferActiveVersion),
    )
    const deactivatedFlowOnlyChangeInfo = deactivatedFlowOnlyChanges.map(change =>
      createDeactivatedFlowChangeInfo(getChangeData(change)),
    )

    if (isSandbox) {
      const sandboxFlowModification = flowChanges
        .filter(isModificationChange)
        .filter(isActiveFlowChange)
        .map(getChangeData)
        .map(instance => newVersionInfo(instance, true))
      return [
        ...inactiveNewVersionChangeInfo,
        ...deactivatedFlowOnlyChangeInfo,
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
        if (getFlowStatus(change.data.before) === INVALID_DRAFT) {
          return activateInvalidFlowError(getChangeData(change))
        }
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

    return [
      ...inactiveNewVersionChangeInfo,
      ...deactivatedFlowOnlyChangeInfo,
      ...activeFlowModification,
      ...activatingFlow,
      ...activeFlowAddition,
      ...removingFlowChangeErrors,
    ]
  }

export default activeFlowValidator
