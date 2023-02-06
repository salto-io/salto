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
import { AdditionChange, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isModificationChange, isRemovalOrModificationChange, ModificationChange, Values } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { createSchemeGuard, resolveValues } from '@salto-io/adapter-utils'
import Joi from 'joi'
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


const log = logger(module)

const PROJECT_TYPE_TO_RESOURCE_TYPE: Record<string, string> = {
  software: 'jira-software',
  service_desk: 'jira-servicedesk',
  business: 'jira-core',
}

type AutomationResponse = {
  id: number
  name: string
  created: number
  projects: {
    projectId: string
  }[]
}[]

const IMPORT_RESPONSE_SCHEME = Joi.array().items(
  Joi.object({
    id: Joi.number().required(),
    name: Joi.string().required(),
    created: Joi.number().required(),
    projects: Joi.array().items(
      Joi.object({
        projectId: Joi.string().allow(null),
      }).unknown(true),
    ).required(),
  }).unknown(true),
)

const isAutomationsResponse = createSchemeGuard<AutomationResponse>(IMPORT_RESPONSE_SCHEME, 'Received an invalid automation import response')

const generateRuleScopesResources = (
  instance: InstanceElement,
  cloudId: string
): string[] => {
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
  cloudId: string | undefined
): {
  ruleScope?: {
    resources: string[]
  }
} => (
  cloudId !== undefined
    ? {
      ruleScope: {
        resources: generateRuleScopesResources(instance, cloudId),
      },
    }
    : {}
)

const getUrlPrefix = (cloudId: string | undefined): string => (
  cloudId === undefined
    ? '/rest/cb-automation/latest/project/GLOBAL'
    : `/gateway/api/automation/internal-api/jira/${cloudId}/pro/rest/GLOBAL`
)

const importAutomation = async (
  instance: InstanceElement,
  client: JiraClient,
  cloudId: string | undefined,
): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> => {
  const resolvedInstance = await resolveValues(instance, getLookUpName, undefined, true)

  const ruleScopes = generateRuleScopes(resolvedInstance, cloudId)

  const data = {
    rules: [{
      ...resolvedInstance.value,
      ...ruleScopes,
    }],
  }

  return client.postPrivate({
    url: `${getUrlPrefix(cloudId)}/rule/import`,
    data,
  })
}

const getAutomationIdentifier = (values: Values): string =>
  [values.name, ...(values.projects ?? []).map((project: Values) => project.projectId)].join('_')

const setInstanceId = async (
  instance: InstanceElement,
  automations: Values[]
): Promise<void> => {
  if (!isAutomationsResponse(automations)) {
    throw new Error(`Received an invalid automation response when attempting to create automation: ${instance.elemID.getFullName()}`)
  }

  const automationById = _.groupBy(automations, automation => getAutomationIdentifier(automation))

  const instanceIdentifier = getAutomationIdentifier(
    (await resolveValues(instance, getLookUpName)).value
  )

  if (automationById[instanceIdentifier] === undefined) {
    throw new Error(`Deployment failed for automation: ${instance.elemID.getFullName()}`)
  }

  if (automationById[instanceIdentifier].length > 1) {
    throw new Error(`Cannot find if of automation: ${instance.elemID.getFullName()} after the deployment, there is more than one automation with the same name ${instance.value.name}`)
  }

  instance.value.id = automationById[instanceIdentifier][0].id
  instance.value.created = automationById[instanceIdentifier][0].created
}

const removeAutomation = async (
  instance: InstanceElement,
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  await client.deletePrivate({
    url: `${getUrlPrefix(cloudId)}/rule/${instance.value.id}`,
  })
}

const getLabelsUrl = (
  cloudId: string | undefined,
  instance: InstanceElement,
  labelID: string
): string => (
  cloudId === undefined
    ? `${getUrlPrefix(cloudId)}/rule/${instance.value.id}/label/${labelID}`
    : `${getUrlPrefix(cloudId)}/rules/${instance.value.id}/labels/${labelID}`
)

const addAutomationLabels = async (
  instance: InstanceElement,
  labelsID: string[],
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  await Promise.all(labelsID.map(async labelID => client.put({
    url: getLabelsUrl(cloudId, instance, labelID),
    data: null,
    headers: { 'Content-Type': 'application/json' },
  })))
}

const removeAutomationLabels = async (
  instance: InstanceElement,
  labelsID: string[],
  client: JiraClient,
  cloudId: string | undefined,
): Promise<void> => {
  await Promise.all(labelsID.map(async labelID => client.delete({
    url: getLabelsUrl(cloudId, instance, labelID),
  })))
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
    url: `${getUrlPrefix(cloudId)}/rule/${instance.value.id}`,
    data,
  })
}

const createAutomation = async (
  instance: InstanceElement,
  client: JiraClient,
  cloudId: string | undefined,
  config: JiraConfig,
): Promise<void> => {
  await importAutomation(instance, client, cloudId)
  const automations = await getAutomations(client, config)
  await setInstanceId(instance, automations)
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

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === AUTOMATION_TYPE
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => {
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
      }
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})
export default filter
