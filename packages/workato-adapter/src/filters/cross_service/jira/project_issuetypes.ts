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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { createSchemeGuard, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { CROSS_SERVICE_SUPPORTED_APPS, JIRA, RECIPE_CODE_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { BlockBase } from '../recipe_block_types'

const INPUT_SEPERATOR = '--'

/* eslint-disable camelcase */

type JiraExportedBlock = BlockBase & {
  as: string
  provider: 'jira' | 'jira_secondary'
  dynamicPickListSelection?: {
    project_issuetype: unknown
    sample_project_issuetype?: unknown
  }
  input: {
    project_issuetype: string
    sample_project_issuetype?: string
    projectKey?: string
    issueType?: string
    sampleProjectKey?: string
    sampleIssueType?: string
  }
}

const JIRA_EXPORTED_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().valid('jira', 'jira_secondary').required(),
  dynamicPickListSelection: Joi.object({
    project_issuetype: Joi.any().required(),
    sample_project_issuetype: Joi.any(),
  }).unknown(true),
  input: Joi.object({
    project_issuetype: Joi.string().required(),
    sample_project_issuetype: Joi.string(),
  }).unknown(true).required(),
}).unknown(true).required()

const splitProjectAndIssueType = (
  value: JiraExportedBlock,
  argName: 'project_issuetype' | 'sample_project_issuetype',
  firstKey: 'projectKey' | 'sampleProjectKey',
  secondKey: 'issueType' | 'sampleIssueType',
): void => {
  const projectKeyAndIssueType = value.input[argName]
  if (projectKeyAndIssueType !== undefined
    && projectKeyAndIssueType.includes(INPUT_SEPERATOR)) {
    // The project key can't contain '-' sign while issueTypeName and projectName could.
    // So we split by first '-' in input args.
    const firstValue = projectKeyAndIssueType.split(INPUT_SEPERATOR, 1)[0]
    const secondValue = projectKeyAndIssueType
      .substring(firstValue.length + INPUT_SEPERATOR.length)
    value.input[firstKey] = firstValue
    value.input[secondKey] = secondValue
    delete value.input[argName]
    if (value.dynamicPickListSelection !== undefined
      && value.dynamicPickListSelection[argName] !== undefined) {
      delete value.dynamicPickListSelection[argName]
    }
  }
}

/**
 * Workato recipe connected to Jira account include jira blocks from the format
 * {
 * ...
 *  dynamicPickListSelection: {
 *    project_issuetype: <project1Name> : <issueType1Name>
 *    sample_project_issuetype: <project2Name> : <issueType2Name>
 *  }
 *  input: {
 *    project_issuetype: <project1Key>--<issueType1Name>
 *    sample_project_issuetype: <project2Key>--<issueType2Name>
 *  }
 * ...
 * }
 * To avoid duplications, we delete the dynamicPickListSelection arguments and split input
 * args to projectKey and issueTypeName
 */

const filter: FilterCreator = () => ({
  name: 'jiraProjectIssueTypeFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === RECIPE_CODE_TYPE)
      .forEach(inst => walkOnElement({
        element: inst,
        func: ({ value }) => {
          const objValues = isInstanceElement(value) ? value.value : value
          if (createSchemeGuard<JiraExportedBlock>(JIRA_EXPORTED_BLOCK_SCHEMA)(objValues)
            && CROSS_SERVICE_SUPPORTED_APPS[JIRA].includes(value.provider)) {
            splitProjectAndIssueType(objValues, 'project_issuetype', 'projectKey', 'issueType')
            splitProjectAndIssueType(objValues, 'sample_project_issuetype', 'sampleProjectKey', 'sampleIssueType')
          }
          return WALK_NEXT_STEP.RECURSE
        },
      }))
  },
})

export default filter
