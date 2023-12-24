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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { elements as adapterElements, config as configUtils, client as clientUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, Element, InstanceElement, ObjectType, SaltoError } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { addAnnotationRecursively, findObject, setTypeDeploymentAnnotations } from '../../utils'
import { CHUNK_SIZE, isWorkflowIdsResponse, isWorkflowResponse } from './types'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { JIRA_WORKFLOW_TYPE } from '../../constants'
import JiraClient from '../../client/client'


const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { toBasicInstance } = adapterElements
const { getTransformationConfigByType } = configUtils

type WorkflowIdsOrFilterResult = {
  workflowIds?: string[]
  errors: SaltoError[]
}

const fetchWorkflowIds = async (paginator: clientUtils.Paginator): Promise<WorkflowIdsOrFilterResult> => {
  const paginationArgs = {
    url: '/rest/api/3/workflow/search',
    paginationField: 'startAt',
  }
  const workflowValues = await awu(paginator(
    paginationArgs,
    page => makeArray(page.values) as clientUtils.ResponseValue[]
  )).flat().toArray()
  if (!isWorkflowIdsResponse(workflowValues)) {
    return {
      errors: [{
        message: 'Received an invalid workflow response from service',
        severity: 'Warning',
      }],
    }
  }
  return { workflowIds: workflowValues.map(value => value.id.entityId), errors: [] }
}

const createWorkspaceInstance = async (
  client: JiraClient,
  workflowIds: string[],
  jiraWorkflowType: ObjectType,
  errors: SaltoError[])
: Promise<InstanceElement[] | undefined> => {
  const response = await client.post({
    url: '/rest/api/3/workflows',
    data: {
      workflowIds,
    },
  })
  if (response.status !== 200) {
    errors.push({
      message: `Failed to fetch workflows with error code ${response.status}.`,
      severity: 'Warning',
    })
    return undefined
  }
  if (!isWorkflowResponse(response.data)) {
    errors.push({
      message: 'Received an invalid workflow response from service.',
      severity: 'Warning',
    })
    return undefined
  }
  return Promise.all(response.data.workflows.map(workflow => (
    toBasicInstance({
      entry: workflow,
      type: jiraWorkflowType,
      transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
      transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
      defaultName: workflow.name,
    })
  )))
}


// This filter uses the new workflow API to fetch workflows
const filter: FilterCreator = ({ config, client, paginator, fetchQuery }) => ({
  name: 'jiraWorkflowFilter',
  onFetch: async (elements: Element[]) => {
    const errors: SaltoError[] = []
    if (!config.fetch.enableNewWorkflowAPI || !fetchQuery.isTypeMatch(JIRA_WORKFLOW_TYPE)) {
      return { errors }
    }
    const jiraWorkflow = findObject(elements, JIRA_WORKFLOW_TYPE)
    if (jiraWorkflow === undefined) {
      errors.push({
        message: 'JiraWorkflow type was not found',
        severity: 'Warning',
      })
      return { errors }
    }
    setTypeDeploymentAnnotations(jiraWorkflow)
    await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.DELETABLE)
    const { workflowIds, errors: fetchWorkflowIdsErrors } = await fetchWorkflowIds(paginator)
    if (!_.isEmpty(fetchWorkflowIdsErrors)) {
      errors.push(...fetchWorkflowIdsErrors)
      return { errors }
    }
    const workflowChunks = _.chunk(workflowIds, CHUNK_SIZE)
    await awu(workflowChunks).forEach(async chunk => {
      elements.push(...(await createWorkspaceInstance(client, chunk, jiraWorkflow, errors)) ?? [])
    })
    return { errors }
  },
})

export default filter
