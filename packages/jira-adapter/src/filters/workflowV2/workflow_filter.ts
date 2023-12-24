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
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { addAnnotationRecursively, findObject, setTypeDeploymentAnnotations } from '../../utils'
import { CHUNK_SIZE, isWorkflowIdsResponse, isWorkflowResponse } from './types'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { JIRA_WORKFLOW_TYPE } from '../../constants'


const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { toBasicInstance } = adapterElements
const { getTransformationConfigByType } = configUtils

const fetchWorkflowIds = async (paginator: clientUtils.Paginator): Promise<string[]> => {
  const paginationArgs = {
    url: '/rest/api/3/workflow/search',
    paginationField: 'startAt',
  }
  const workflowValues = await awu(paginator(
    paginationArgs,
    page => makeArray(page.values) as clientUtils.ResponseValue[]
  )).flat().toArray()
  if (!isWorkflowIdsResponse(workflowValues)) {
    throw new Error('Received an invalid workflow response from service')
  }
  return workflowValues.map(value => value.id.entityId)
}

// This filter transforms the workflow values structure so it will fit its deployment endpoint
const filter: FilterCreator = ({ config, client, paginator }) => ({
  name: 'jiraWorkflowDeployFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableNewWorkflowAPI) {
      return
    }
    const jiraWorkflow = findObject(elements, JIRA_WORKFLOW_TYPE)
    if (jiraWorkflow === undefined) {
      throw new Error('JiraWorkflow type not found')
    }
    setTypeDeploymentAnnotations(jiraWorkflow)
    await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.DELETABLE)
    const workflowIds = await fetchWorkflowIds(paginator)
    const workflowChunks = _.chunk(workflowIds, CHUNK_SIZE)
    workflowChunks.forEach(async chunk => {
      const response = await client.post({
        url: '/rest/api/3/workflows',
        data: {
          workflowIds: chunk,
        },
      })
      if (!isWorkflowResponse(response.data)) {
        throw new Error('Received an invalid workflow response from service')
      }
      elements.push(...await Promise.all(response.data.workflows.map(async workflow => (
        toBasicInstance({
          entry: workflow,
          type: jiraWorkflow,
          transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
          transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
          defaultName: workflow.name,
        })
      ))))
    })
  },
})

export default filter
