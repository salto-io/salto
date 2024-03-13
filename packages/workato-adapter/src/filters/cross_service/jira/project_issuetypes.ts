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
  Element,
  InstanceElement,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { createSchemeGuard, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { CROSS_SERVICE_SUPPORTED_APPS, JIRA, RECIPE_CODE_TYPE, RECIPE_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { BlockBase } from '../recipe_block_types'

const INPUT_SEPERATOR = '--'
const PROJECT_ISSUETYPE = 'project_issuetype'
const SAMPLE_PROJECT_ISSUETYPE = 'sample_project_issuetype'
const PROJECT_KEY = 'projectKey'
const ISSUE_TYPE = 'issueType'
const SAMPLE_PROJECT_KEY = 'sampleProjectKey'
const SAMPLE_ISSUE_TYPE = 'sampleIssueType'

/* eslint-disable camelcase */
type JiraExportedBlock = BlockBase & {
  as: string
  provider: 'jira' | 'jira_secondary'
  dynamicPickListSelection?: {
    [PROJECT_ISSUETYPE]?: unknown
    [SAMPLE_PROJECT_ISSUETYPE]?: unknown
  }
  input: {
    [PROJECT_ISSUETYPE]?: string
    [SAMPLE_PROJECT_ISSUETYPE]?: string
    [PROJECT_KEY]?: string
    [ISSUE_TYPE]?: string
    [SAMPLE_PROJECT_KEY]?: string
    [SAMPLE_ISSUE_TYPE]?: string
  }
}

type ProjectIssuetypeFunc = (
  value: JiraExportedBlock,
  originalFieldName: typeof PROJECT_ISSUETYPE | typeof SAMPLE_PROJECT_ISSUETYPE,
  firstKey: typeof PROJECT_KEY | typeof SAMPLE_PROJECT_KEY,
  secondKey: typeof ISSUE_TYPE | typeof SAMPLE_ISSUE_TYPE,
) => void

const JIRA_IMPORTED_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().valid('jira', 'jira_secondary').required(),
  input: Joi.object({
    [PROJECT_KEY]: Joi.any().required(),
    [ISSUE_TYPE]: Joi.any().required(),
    [SAMPLE_PROJECT_KEY]: Joi.any(),
    [SAMPLE_ISSUE_TYPE]: Joi.any(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const JIRA_EXPORTED_BLOCK_SCHEMA = Joi.object({
  keyword: Joi.string().required(),
  as: Joi.string().required(),
  provider: Joi.string().valid('jira', 'jira_secondary').required(),
  dynamicPickListSelection: Joi.object({
    [PROJECT_ISSUETYPE]: Joi.any().required(),
    [SAMPLE_PROJECT_ISSUETYPE]: Joi.any(),
  }).unknown(true),
  input: Joi.object({
    [PROJECT_ISSUETYPE]: Joi.string().required(),
    [SAMPLE_PROJECT_ISSUETYPE]: Joi.string(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const splitProjectAndIssueType: ProjectIssuetypeFunc = (value, argName, firstKey, secondKey) => {
  const projectKeyAndIssueType = value.input[argName]
  if (projectKeyAndIssueType !== undefined && projectKeyAndIssueType.includes(INPUT_SEPERATOR)) {
    // The project key can't contain '-' sign while issueTypeName and projectName could.
    // So we split by first '-' in input args.
    const firstValue = projectKeyAndIssueType.split(INPUT_SEPERATOR, 1)[0]
    const secondValue = projectKeyAndIssueType.substring(firstValue.length + INPUT_SEPERATOR.length)
    value.input[firstKey] = firstValue
    value.input[secondKey] = secondValue
    delete value.input[argName]
    if (value.dynamicPickListSelection !== undefined && value.dynamicPickListSelection[argName] !== undefined) {
      delete value.dynamicPickListSelection[argName]
    }
  }
}

const mergeProjectAndIssueType: ProjectIssuetypeFunc = (value, argName, firstKey, secondKey) => {
  const projectKey = value.input[firstKey]
  const issueType = value.input[secondKey]
  if (projectKey !== undefined && issueType !== undefined) {
    value.input[argName] = `${projectKey}${INPUT_SEPERATOR}${issueType}`
    delete value.input[firstKey]
    delete value.input[secondKey]
  }
}

const splitAllProjectAndIssueType = (inst: InstanceElement): void =>
  walkOnElement({
    element: inst,
    func: ({ value }) => {
      const objValues = isInstanceElement(value) ? value.value : value
      if (
        createSchemeGuard<JiraExportedBlock>(JIRA_EXPORTED_BLOCK_SCHEMA)(objValues) &&
        CROSS_SERVICE_SUPPORTED_APPS[JIRA].includes(value.provider)
      ) {
        splitProjectAndIssueType(objValues, PROJECT_ISSUETYPE, PROJECT_KEY, ISSUE_TYPE)
        splitProjectAndIssueType(objValues, SAMPLE_PROJECT_ISSUETYPE, SAMPLE_PROJECT_KEY, SAMPLE_ISSUE_TYPE)
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

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
      .forEach(inst => splitAllProjectAndIssueType(inst))
  },

  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(inst => [RECIPE_CODE_TYPE, RECIPE_TYPE].includes(inst.elemID.typeName))
      .forEach(inst =>
        walkOnElement({
          element: inst,
          func: ({ value }) => {
            const objValues = isInstanceElement(value) ? value.value : value
            if (
              createSchemeGuard<JiraExportedBlock>(JIRA_IMPORTED_BLOCK_SCHEMA)(objValues) &&
              CROSS_SERVICE_SUPPORTED_APPS[JIRA].includes(value.provider)
            ) {
              mergeProjectAndIssueType(objValues, PROJECT_ISSUETYPE, PROJECT_KEY, ISSUE_TYPE)
              mergeProjectAndIssueType(objValues, SAMPLE_PROJECT_ISSUETYPE, SAMPLE_PROJECT_KEY, SAMPLE_ISSUE_TYPE)
            }
            return WALK_NEXT_STEP.RECURSE
          },
        }),
      )
  },

  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(inst => [RECIPE_CODE_TYPE, RECIPE_TYPE].includes(inst.elemID.typeName))
      .forEach(inst => splitAllProjectAndIssueType(inst))
  },
})
export default filter
