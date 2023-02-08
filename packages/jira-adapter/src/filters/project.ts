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
import { Change, Element, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { createSchemeGuard, resolveValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import JiraClient from '../client/client'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { getLookUpName } from '../reference_mapping'
import { FilterCreator } from '../filter'
import { findObject, isFreeLicense, setFieldDeploymentAnnotations } from '../utils'
import { PROJECT_CONTEXTS_FIELD } from './fields/contexts_projects_filter'

const PROJECT_TYPE_NAME = 'Project'

const WORKFLOW_SCHEME_FIELD = 'workflowScheme'
const COMPONENTS_FIELD = 'components'
const ISSUE_TYPE_SCREEN_SCHEME_FIELD = 'issueTypeScreenScheme'
const FIELD_CONFIG_SCHEME_FIELD = 'fieldConfigurationScheme'
const ISSUE_TYPE_SCHEME = 'issueTypeScheme'
const PRIORITY_SCHEME = 'priorityScheme'
const PERMISSION_SCHEME_FIELD = 'permissionScheme'

const log = logger(module)

const deployScheme = async (
  instance: InstanceElement,
  client: JiraClient,
  schemeInstanceField: string,
  schemeBodyField: string,
): Promise<void> => {
  if (instance.value[schemeInstanceField] !== undefined) {
    await client.put({
      url: `/rest/api/3/${schemeInstanceField.toLowerCase()}/project`,
      data: {
        [schemeBodyField]: instance.value[schemeInstanceField],
        projectId: instance.value.id,
      },
    })
  }
}

const deployPriorityScheme = async (
  instance: InstanceElement,
  client: JiraClient,
): Promise<void> => {
  if (!client.isDataCenter) {
    return
  }
  await client.put({
    url: `/rest/api/2/project/${instance.value.id}/priorityscheme`,
    data: {
      id: instance.value[PRIORITY_SCHEME],
    },
  })
}

const deployProjectSchemes = async (
  instance: InstanceElement,
  client: JiraClient,
): Promise<void> => {
  await deployScheme(instance, client, WORKFLOW_SCHEME_FIELD, 'workflowSchemeId')
  await deployScheme(instance, client, ISSUE_TYPE_SCREEN_SCHEME_FIELD, 'issueTypeScreenSchemeId')
  await deployScheme(instance, client, ISSUE_TYPE_SCHEME, 'issueTypeSchemeId')
  await deployPriorityScheme(instance, client)
}

type ComponentsResponse = {
  components?: {
    id: string
  }[]
}

const shouldSeparateSchemeDeployment = (change: Change, isDataCenter: boolean): boolean =>
  isModificationChange(change)
  || (isAdditionChange(change) && isDataCenter)

const COMPONENTS_RESPONSE_SCHEME = Joi.object({
  components: Joi.array().items(Joi.object({
    id: Joi.string().required(),
  }).unknown(true)),
}).unknown(true).required()

const isComponentsResponse = createSchemeGuard<ComponentsResponse>(COMPONENTS_RESPONSE_SCHEME, 'Received an invalid project component response')

const getProjectComponentIds = async (projectId: number, client: JiraClient): Promise<string[]> => {
  const response = await client.getSinglePage({
    url: `/rest/api/3/project/${projectId}`,
  })

  if (!isComponentsResponse(response.data)) {
    throw new Error('Received an invalid project component response')
  }

  return response.data.components?.map(({ id }) => id) || []
}

const removeComponents = async (projectId: number, client: JiraClient): Promise<void> => {
  const componentIds = await getProjectComponentIds(projectId, client)

  await Promise.all(componentIds.map(id => client.delete({
    url: `/rest/api/3/component/${id}`,
  })))
}

const isIdResponse = createSchemeGuard<{ id: string }>(Joi.object({
  id: Joi.string().required(),
}).unknown(true).required(), 'Received an invalid project id response')

const getProjectId = async (projectKey: string, client: JiraClient): Promise<string> => {
  const response = await client.getSinglePage({
    url: `/rest/api/3/project/${projectKey}`,
  })

  if (!isIdResponse(response.data)) {
    throw new Error('Received an invalid project id response')
  }

  return response.data.id
}

const isFieldConfigurationSchemeResponse = createSchemeGuard<{
  values: {
    fieldConfigurationScheme?: {
      id: string
    }
  }[]
}>(Joi.object({
  values: Joi.array().items(Joi.object({
    fieldConfigurationScheme: Joi.object({
      id: Joi.string().required(),
    }).unknown(true).optional(),
  }).unknown(true)),
}).unknown(true).required(), 'Received an invalid field configuration scheme response')

const deleteFieldConfigurationScheme = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const instance = await resolveValues(getChangeData(change), getLookUpName)
  const response = await client.getSinglePage({
    url: `/rest/api/3/fieldconfigurationscheme/project?projectId=${instance.value.id}`,
  })

  if (!isFieldConfigurationSchemeResponse(response.data)) {
    throw new Error('Received an invalid field configuration scheme response')
  }

  if (response.data.values.length === 0) {
    log.warn(`Expected to find a field configuration scheme for project ${instance.elemID.getFullName()}`)
    return
  }

  await deployScheme(instance, client, FIELD_CONFIG_SCHEME_FIELD, 'fieldConfigurationSchemeId')

  if (response.data.values[0]?.fieldConfigurationScheme === undefined) {
    log.debug(`project ${instance.elemID.getFullName()} does not have a field configuration scheme, skipping deletion`)
    return
  }

  const schemeId = response.data.values[0].fieldConfigurationScheme.id
  await client.delete({
    url: `/rest/api/3/fieldconfigurationscheme/${schemeId}`,
  })
}

/**
 * Restructures Project type to fit the deployment endpoint
 */
const filter: FilterCreator = ({ config, client, elementsSource }) => ({
  name: 'projectFilter',
  onFetch: async (elements: Element[]) => {
    const projectType = findObject(elements, PROJECT_TYPE_NAME)
    if (projectType !== undefined) {
      setFieldDeploymentAnnotations(projectType, WORKFLOW_SCHEME_FIELD)
      setFieldDeploymentAnnotations(projectType, ISSUE_TYPE_SCREEN_SCHEME_FIELD)
      setFieldDeploymentAnnotations(projectType, FIELD_CONFIG_SCHEME_FIELD)
      setFieldDeploymentAnnotations(projectType, ISSUE_TYPE_SCHEME)
      setFieldDeploymentAnnotations(projectType, COMPONENTS_FIELD)
      setFieldDeploymentAnnotations(projectType, PROJECT_CONTEXTS_FIELD)

      if (client.isDataCenter) {
        setFieldDeploymentAnnotations(projectType, PRIORITY_SCHEME)
      }
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.leadAccountId = client.isDataCenter ? instance.value.lead?.key : instance.value.lead?.accountId
        delete instance.value.lead

        instance.value[WORKFLOW_SCHEME_FIELD] = instance
          .value[WORKFLOW_SCHEME_FIELD]?.[WORKFLOW_SCHEME_FIELD]?.id?.toString()
        instance.value.issueTypeScreenScheme = instance
          .value[ISSUE_TYPE_SCREEN_SCHEME_FIELD]?.[ISSUE_TYPE_SCREEN_SCHEME_FIELD]?.id
        instance.value.fieldConfigurationScheme = instance
          .value[FIELD_CONFIG_SCHEME_FIELD]?.[FIELD_CONFIG_SCHEME_FIELD]?.id
        instance.value[ISSUE_TYPE_SCHEME] = instance
          .value[ISSUE_TYPE_SCHEME]?.[ISSUE_TYPE_SCHEME]?.id

        instance.value.notificationScheme = instance.value.notificationScheme?.id?.toString()
        instance.value.permissionScheme = instance.value.permissionScheme?.id?.toString()
        instance.value.issueSecurityScheme = instance.value.issueSecurityScheme?.id?.toString()
      })
  },

  preDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.lead = instance.value.leadAccountId
        delete instance.value.leadAccountId
      })
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === PROJECT_TYPE_NAME
        && isAdditionOrModificationChange(change)
    )

    const getFieldsToIgnore = async (change: Change<InstanceElement>): Promise<string[]> => {
      const fieldsToIgnore = [
        COMPONENTS_FIELD,
        FIELD_CONFIG_SCHEME_FIELD,
        PROJECT_CONTEXTS_FIELD,
        PRIORITY_SCHEME,
      ]
      if (shouldSeparateSchemeDeployment(change, client.isDataCenter)) {
        fieldsToIgnore.push(WORKFLOW_SCHEME_FIELD, ISSUE_TYPE_SCREEN_SCHEME_FIELD, ISSUE_TYPE_SCHEME)
      }
      if (await isFreeLicense(elementsSource)) {
        fieldsToIgnore.push(PERMISSION_SCHEME_FIELD)
      }
      return fieldsToIgnore
    }

    const deployResult = await deployChanges(
      relevantChanges as Change<InstanceElement>[],
      async change => {
        try {
          await defaultDeployChange({
            change,
            client,
            apiDefinitions: config.apiDefinitions,
            fieldsToIgnore: await getFieldsToIgnore(change),
          })
        } catch (error) {
          // When a JSM project is created, a fieldConfigurationScheme is created
          // automatically with the name "Jira Service Management Field Configuration Scheme
          // for Project <project key>"". There seems to be a bug in Jira that if a
          // fieldConfigurationScheme with that name already exists, the request
          // fails with 500 although the project is created and another fieldConfigurationScheme
          // with the same name is created (although in the UI you can’t create two
          // fieldConfigurationScheme with the same name). To overcome this, we delete the
          // fieldConfigurationScheme that was automatically created and set the right one
          if (isAdditionChange(change) && error.response?.status === 500) {
            log.debug('Received 500 when creating a project, checking if the project was created and fixing its field configuration scheme')
            change.data.after.value.id = await getProjectId(change.data.after.value.key, client)
            await deleteFieldConfigurationScheme(change, client)
          } else {
            throw error
          }
        }

        const instance = await resolveValues(getChangeData(change), getLookUpName)
        if (shouldSeparateSchemeDeployment(change, client.isDataCenter)) {
          await deployProjectSchemes(instance, client)
        }

        await deployScheme(instance, client, FIELD_CONFIG_SCHEME_FIELD, 'fieldConfigurationSchemeId')

        if (isAdditionChange(change)) {
          // In some projects, some components are created as a side effect
          // when creating the project. We want to remove these and deploy
          // the components that are in the NaCls
          await removeComponents(getChangeData(change).value.id, client)
        }
      }
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },

  onDeploy: async (changes: Change<Element>[]) => {
    changes
      .filter(isAdditionChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.id = instance.value.id?.toString()
      })
    if (!client.isDataCenter) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
      .forEach(instance => {
        instance.value.leadAccountId = instance.value.lead
        delete instance.value.lead
      })
  },
})

export default filter
