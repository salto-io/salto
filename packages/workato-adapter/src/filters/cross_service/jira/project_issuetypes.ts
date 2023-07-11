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
import { Element, isInstanceElement, Value } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { CROSS_SERVICE_SUPPORTED_APPS, JIRA, RECIPE_CODE_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'

const INPUT_SEPERATOR = '--'

const splitProjectAndIssueType = (
  value: Value, argName: 'project_issuetype' | 'sample_project_issuetype', firstKey: string, secondKey: string
): void => {
  const objValues = isInstanceElement(value) ? value.value : value
  if (_.isPlainObject(objValues)
    && _.isObjectLike(objValues.input)
    && CROSS_SERVICE_SUPPORTED_APPS[JIRA].includes(value.provider)
    && objValues.input[argName] !== undefined
    && objValues.input[argName].includes(INPUT_SEPERATOR)
    && _.isObjectLike(objValues.dynamicPickListSelection)
    && objValues.dynamicPickListSelection[argName] !== undefined) {
    // The project key can't contain '-' sign while issueTypeName and projectName could.
    // So we split by first '-' in input args.
    const firstValue = objValues.input[argName].split(INPUT_SEPERATOR, 1)[0]
    const secondValue = objValues.input[argName]
      .substring(firstValue.length + INPUT_SEPERATOR.length)
    objValues.input[firstKey] = firstValue
    objValues.input[secondKey] = secondValue
    delete objValues.input[argName]
    delete objValues.dynamicPickListSelection[argName]
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
          splitProjectAndIssueType(value, 'project_issuetype', 'projectKey', 'issueType')
          splitProjectAndIssueType(value, 'sample_project_issuetype', 'sampleProjectKey', 'sampleIssueType')
          return WALK_NEXT_STEP.RECURSE
        },
      }))
  },
})

export default filter
