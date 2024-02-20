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
import _ from 'lodash'
import { InstanceElement, ElemID, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { DependencyDirection } from '@salto-io/adapter-utils'
import {
  addReferencesForService,
  FormulaReferenceFinder,
  MappedReference,
  ReferenceFinder,
  createMatcher,
  Matcher,
  getBlockDependencyDirection,
} from '../reference_finders'
import { JiraIndex } from './element_index'
import { isJiraBlock, JiraBlock } from './recipe_block_types'

const { isDefined } = lowerdashValues

type JiraFieldMatchGroup = { obj?: string; field: string; block: string }
const isJiraFieldMatchGroup = (val: Values): val is JiraFieldMatchGroup => _.isString(val.field)

const createFormulaFieldMatcher = (application: string): Matcher<JiraFieldMatchGroup> =>
  // example: ('data.jira.1234abcd.fields.project.self')
  // example: ('data.jira.1234abcd.fields.customfield_10027')
  // example: ('data.jira.1234abcd.fields.description')
  // example: ('data.jira.1234abcd.issues.first.fields.reporter.key')
  createMatcher(
    [new RegExp(`\\('data\\.${application}\\.[^\\)]*?\\.fields\\.(?<field>\\w+)[^\\)]*?'\\)`, 'g')],
    isJiraFieldMatchGroup,
  )

const getPotentialReferences = (
  key: unknown,
  keyPath: ElemID,
  index: Record<string, Readonly<InstanceElement>>,
  location: ElemID,
  direction: DependencyDirection | undefined,
): MappedReference | undefined => {
  if (!_.isString(key) || key.length === 0) {
    return undefined
  }

  const refProject = index[key]
  if (refProject === undefined) {
    return undefined
  }

  return {
    pathToOverride: keyPath,
    location: new ReferenceExpression(location),
    direction,
    reference: new ReferenceExpression(refProject.elemID),
  }
}

export const addJiraRecipeReferences = async (
  inst: InstanceElement,
  indexedElements: JiraIndex,
  appName: string,
): Promise<void> => {
  const referenceFinder: ReferenceFinder<JiraBlock> = (blockValue, path) => {
    const { input } = blockValue
    const direction = getBlockDependencyDirection(blockValue)

    return [
      getPotentialReferences(
        input.projectKey,
        path.createNestedID('input', 'projectKey'),
        indexedElements.projectByKey,
        path,
        direction,
      ),
      getPotentialReferences(
        input.issueType,
        path.createNestedID('input', 'issueType'),
        indexedElements.issueTypeByName,
        path,
        direction,
      ),
      getPotentialReferences(
        input.sampleProjectKey,
        path.createNestedID('input', 'sampleProjectKey'),
        indexedElements.projectByKey,
        path,
        direction,
      ),
      getPotentialReferences(
        input.sampleIssueType,
        path.createNestedID('input', 'sampleIssueType'),
        indexedElements.issueTypeByName,
        path,
        direction,
      ),
    ].filter(isDefined)
  }

  const formulaFieldMatcher = createFormulaFieldMatcher(appName)

  const formulaReferenceFinder: FormulaReferenceFinder = (value, path) => {
    const potentialFields = formulaFieldMatcher(value).map(match => match.field)
    return potentialFields
      .map((fieldNameId: string): MappedReference | undefined => {
        const referencedId = indexedElements.fieldById[fieldNameId]
        if (referencedId !== undefined) {
          return {
            location: new ReferenceExpression(path),
            // references inside formulas are always used as input
            direction: 'input',
            reference: new ReferenceExpression(referencedId),
          }
        }
        return undefined
      })
      .filter(isDefined)
  }

  return addReferencesForService<JiraBlock>(inst, appName, isJiraBlock, referenceFinder, formulaReferenceFinder)
}
