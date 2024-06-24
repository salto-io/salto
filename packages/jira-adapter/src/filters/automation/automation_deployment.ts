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
import {
  AdditionChange,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  isRemovalOrModificationChange,
  ModificationChange,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'

import Joi from 'joi'
import { collections } from '@salto-io/lowerdash'
import { getDiffIds } from '../../diff'
import { AUTOMATION_TYPE } from '../../constants'
import { addAnnotationRecursively, findObject, setTypeDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { getLookUpName } from '../../reference_mapping'
import { getCloudId } from './cloud_id'
import { getAutomations } from './automation_fetch'
import { JiraConfig } from '../../config/config'
import { PROJECT_TYPE_TO_RESOURCE_TYPE } from './automation_structure'

const log = logger(module)
const { awu } = collections.asynciterable

type ImportResponse = {
  id: string
}

const IMPORT_RESPONSE_SCHEME = Joi.object({
  id: Joi.string().required(),
}).unknown(true)

const isImportResponse = createSchemeGuard<ImportResponse>(
  IMPORT_RESPONSE_SCHEME,
  'Received an invalid automation import response',
)

type ProgressResponse = {
  taskState: string
}

const PROGRESS_RESPONSE_SCHEME = Joi.object({
  taskState: Joi.string().required(),
}).unknown(true)

const isProgressResponse = createSchemeGuard<ProgressResponse>(
  PROGRESS_RESPONSE_SCHEME,
  'Received an invalid automation progress response',
)

type AutomationResponse = {
  id: number
  name: string
  created: number
  projects: {
    projectId: string
  }[]
}

const AUTOMATION_RESPONSE_SCHEME = Joi.array().items(
  Joi.object({
    id: Joi.number().required(),
    name: Joi.string().required(),
    created: Joi.number().required(),
    projects: Joi.array()
      .items(
        Joi.object({
          projectId: Joi.string().allow(null),
        }).unknown(true),
      )
      .required(),
  }).unknown(true),
)

const isAutomationsResponse = createSchemeGuard<AutomationResponse[]>(
  AUTOMATION_RESPONSE_SCHEME,
  'Received an invalid automation import response',
)
type Component = {
  children: Component[]
  conditions: Component[]
}

type AssetComponent = {
  value: {
    workspaceId?: string
    schemaId: ReferenceExpression
    objectTypeId?: ReferenceExpression
    schemaLabel?: string
    objectTypeLabel?: string
  }
}

const ASSET_COMPONENT_SCHEME = Joi.object({
  value: Joi.object({
    schemaId: Joi.required(),
  })
    .unknown(true)
    .required(),
}).unknown(true)

export const isAssetComponent = createSchemeGuard<AssetComponent>(ASSET_COMPONENT_SCHEME)

type requestTypeComponent = {
  value: {
    requestType: ReferenceExpression
    serviceDesk?: string
  }
}

const REQUEST_TYPE_COMPONENT_SCHEME = Joi.object({
  value: Joi.object({
    requestType: Joi.required(),
    serviceDesk: Joi.string().optional(),
  })
    .unknown(true)
    .required(),
}).unknown(true)

const isRequestTypeComponent = createSchemeGuard<requestTypeComponent>(REQUEST_TYPE_COMPONENT_SCHEME)

const generateRuleScopesResources = (instance: InstanceElement, cloudId: string): string[] => {
  if ((instance.value.projects ?? []).length === 0) {
    return [`ari:cloud:jira::site/${cloudId}`]
  }

  return instance.value.projects.map((project: Values) => {
    if (project.projectId !== undefined) {
      return `ari:cloud:jira:${cloudId}:project/${project.projectId}`
    }

    return `ari:cloud:${PROJECT_TYPE_TO_RESOURCE_TYPE[project.projectTypeKey]}::site/${cloudId}`
  })
}

const generateRuleScopes = (
  instance: InstanceElement,
  cloudId: string | undefined,
): {
  ruleScope?: {
    resources: string[]
  }
} =>
  cloudId !== undefined
    ? {
        ruleScope: {
          resources: generateRuleScopesResources(instance, cloudId),
        },
      }
    : {}

const getUrlPrefix = (cloudId: string | undefined): string =>
  cloudId === undefined
    ? '/rest/cb-automation/latest/project'
    : `/gateway/api/automation/internal-api/jira/${cloudId}/pro/rest`

const awaitSuccessfulImport = async ({
  client,
  cloudId,
  importId,
  retries,
  delay,
}: {
  client: JiraClient
  cloudId: string | undefined
  importId: string
  retries: number
  delay: number
}): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, delay))
  const progressResponse = (
    await client.getPrivate({
      url: `${getUrlPrefix(cloudId)}/task/${importId}/progress`,
    })
  ).data
  if (!isProgressResponse(progressResponse)) {
    log.error('Received an invalid automation progress response')
    return false
  }
  if (progressResponse.taskState === 'SUCCESS') {
    return true
  }
  if (retries === 0) {
    log.error('Failed to import automation- did not received success response after await timeout')
    return false
  }
  log.info('Automation import not finished, retrying')
  return awaitSuccessfulImport({
    client,
    cloudId,
    importId,
    retries: retries - 1,
    delay,
  })
}

const importAutomation = async (
  instance: InstanceElement,
  client: JiraClient,
  cloudId: string | undefined,
  config: JiraConfig,
): Promise<boolean> => {
  const resolvedInstance = await resolveValues(instance, getLookUpName, undefined, true)

  const ruleScopes = generateRuleScopes(resolvedInstance, cloudId)

  const data = {
    rules: [
      {
        ...resolvedInstance.value,
        ...ruleScopes,
      },
    ],
  }
  log.trace('Importing automation %o', data)
  const importResponse = (
    await client.postPrivate({
      url: `${getUrlPrefix(cloudId)}/GLOBAL/rule/import`,
      data,
    })
  ).data

  // DC call import in a sync manner, cloud in an async
  if (cloudId === undefined) {
    return true
  }

  if (!isImportResponse(importResponse)) {
    throw new Error('Received an invalid automation import response')
  }

  return awaitSuccessfulImport({
    client,
    cloudId,
    importId: importResponse.id,
    retries: config.deploy.taskMaxRetries,
    delay: config.deploy.taskRetryDelay,
  })
}

const getAutomationIdentifier = (values: Values): string =>
  [values.name, ..._.sortBy((values.projects ?? []).map((project: Values) => project.projectId))].join('_')

const getAutomationIdentifierFromService = async ({
  instance,
  client,
  config,
}: {
  instance: InstanceElement
  client: JiraClient
  config: JiraConfig
}): Promise<AutomationResponse> => {
  log.info(`Getting automation identifier for ${instance.elemID.getFullName()}`)
  const automations = await getAutomations(client, config)
  if (!isAutomationsResponse(automations)) {
    throw new Error('Received an invalid automation response when attempting to create automation')
  }
  const automationById = _.groupBy(automations, automation => getAutomationIdentifier(automation))

  const instanceIdentifier = getAutomationIdentifier((await resolveValues(instance, getLookUpName)).value)

  log.info('Automations identifiers: %o', Object.keys(automationById))
  log.info('Deployed Automation identifier: %o', instanceIdentifier)

  if (automationById[instanceIdentifier] === undefined) {
    throw new Error('Cannot find id of automation after the deployment')
  }

  if (automationById[instanceIdentifier].length > 1) {
    throw new Error(
      `Cannot find id of automation after the deployment, there is more than one automation with the same name ${instance.value.name}`,
    )
  }
  return automationById[instanceIdentifier][0]
}

const removeAutomation = async (
  instance: InstanceElement,
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  await client.deletePrivate({
    url: `${getUrlPrefix(cloudId)}/GLOBAL/rule/${instance.value.id}`,
    headers: { 'Content-Type': 'application/json' },
  })
}

const getLabelsUrl = (cloudId: string | undefined, instance: InstanceElement, labelID: string): string =>
  cloudId === undefined
    ? `${getUrlPrefix(cloudId)}/GLOBAL/rule/${instance.value.id}/label/${labelID}`
    : `${getUrlPrefix(cloudId)}/GLOBAL/rules/${instance.value.id}/labels/${labelID}`

const addAutomationLabels = async (
  instance: InstanceElement,
  labelsID: string[],
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  await Promise.all(
    labelsID.map(async labelID =>
      client.put({
        url: getLabelsUrl(cloudId, instance, labelID),
        data: null,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

const removeAutomationLabels = async (
  instance: InstanceElement,
  labelsID: string[],
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  await Promise.all(
    labelsID.map(async labelID =>
      client.delete({
        url: getLabelsUrl(cloudId, instance, labelID),
      }),
    ),
  )
}

const updateAutomationLabels = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  const { addedIds: addedLabels, removedIds: removedLabels } = getDiffIds(
    isRemovalOrModificationChange(change) ? change.data.before.value.labels ?? [] : [],
    isAdditionOrModificationChange(change) ? change.data.after.value.labels ?? [] : [],
  )
  if (addedLabels.length !== 0) {
    await addAutomationLabels(getChangeData(change), addedLabels, client, cloudId)
  }
  if (removedLabels.length !== 0) {
    await removeAutomationLabels(getChangeData(change), removedLabels, client, cloudId)
  }
}
const proccessComponentPreDeploy = (component: Component, config: JiraConfig): void => {
  if (config.fetch.enableJSMPremium && isAssetComponent(component)) {
    const schema = component.value.schemaId.value
    component.value.schemaLabel = schema.value.name
    component.value.workspaceId = schema.value.workspaceId
    if (component.value.objectTypeId !== undefined) {
      const objectType = component.value.objectTypeId.value
      component.value.objectTypeLabel = objectType.value.name
    }
  }
  if (isRequestTypeComponent(component)) {
    const requestType = component.value.requestType.value
    if (requestType?.value !== undefined) {
      component.value.serviceDesk = requestType.value.serviceDeskId
    }
  }
  if (component.children) {
    component.children.forEach(child => proccessComponentPreDeploy(child, config))
  }
  if (component.conditions) {
    component.conditions.forEach(child => proccessComponentPreDeploy(child, config))
  }
}
const modifyComponentsPreDeploy = (instance: InstanceElement, config: JiraConfig): void => {
  if (!config.fetch.enableJSM) {
    return
  }
  if (instance.value.components !== undefined) {
    instance.value.components.forEach((component: Component) => proccessComponentPreDeploy(component, config))
  }
  if (instance.value.trigger !== undefined) {
    proccessComponentPreDeploy(instance.value.trigger, config)
  }
}

const proccessComponentPostDeploy = (component: Component, config: JiraConfig): void => {
  if (config.fetch.enableJSMPremium && isAssetComponent(component)) {
    delete component.value.schemaLabel
    delete component.value.objectTypeLabel
    delete component.value.workspaceId
  }
  if (isRequestTypeComponent(component)) {
    delete component.value.serviceDesk
  }
  if (component.children) {
    component.children.forEach(child => proccessComponentPostDeploy(child, config))
  }
  if (component.conditions) {
    component.conditions.forEach(child => proccessComponentPostDeploy(child, config))
  }
}

const modifyComponentsPostDeploy = (instance: InstanceElement, config: JiraConfig): void => {
  if (!config.fetch.enableJSM) {
    return
  }
  if (instance.value.components !== undefined) {
    instance.value.components.forEach((component: Component) => proccessComponentPostDeploy(component, config))
  }
  if (instance.value.trigger !== undefined) {
    proccessComponentPostDeploy(instance.value.trigger, config)
  }
}

const updateAutomation = async (
  instance: InstanceElement,
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  const resolvedInstance = await resolveValues(instance, getLookUpName, undefined, true)

  const ruleScopes = generateRuleScopes(resolvedInstance, cloudId)

  const data = !client.isDataCenter
    ? {
        ruleConfigBean: {
          ...resolvedInstance.value,
          ...ruleScopes,
        },
      }
    : resolvedInstance.value

  await client.putPrivate({
    url: `${getUrlPrefix(cloudId)}/GLOBAL/rule/${instance.value.id}`,
    data,
  })
}

const createAutomation = async (
  instance: InstanceElement,
  client: JiraClient,
  cloudId: string | undefined,
  config: JiraConfig,
): Promise<void> => {
  const successfulImport = await importAutomation(instance, client, cloudId, config)
  if (!successfulImport) {
    log.warn('Failed to import automation, trying to continue deployment')
  }
  const automationResponse = await getAutomationIdentifierFromService({
    instance,
    client,
    config,
  })
  instance.value.id = automationResponse.id
  instance.value.created = automationResponse.created
  if (instance.value.state === 'ENABLED') {
    // Import automation ignore the state and always create the automation as disabled
    await updateAutomation(instance, client, cloudId)
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'automationDeploymentFilter',
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping automation deployment filter because private API is not enabled')
      return
    }

    const automationType = findObject(elements, AUTOMATION_TYPE)
    if (automationType === undefined) {
      return
    }

    await addAnnotationRecursively(automationType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(automationType, CORE_ANNOTATIONS.UPDATABLE)
    setTypeDeploymentAnnotations(automationType)
  },
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
      .forEach(instance => modifyComponentsPreDeploy(instance, config))
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === AUTOMATION_TYPE,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const cloudId = !client.isDataCenter ? await getCloudId(client) : undefined
      if (isAdditionChange(change)) {
        await createAutomation(getChangeData(change), client, cloudId, config)
        await updateAutomationLabels(change, client, cloudId)
      } else if (isModificationChange(change)) {
        await updateAutomation(getChangeData(change), client, cloudId)
        await updateAutomationLabels(change, client, cloudId)
      } else {
        await removeAutomation(getChangeData(change), client, cloudId)
      }
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
      .forEach(instance => modifyComponentsPostDeploy(instance, config))
  },
})
export default filter
