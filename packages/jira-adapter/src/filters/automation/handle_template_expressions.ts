/*
*                      Copyright 2022 Salto Labs Ltd.
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
  Change, Element, getChangeData, InstanceElement, isInstanceElement,
  ReferenceExpression, TemplateExpression, TemplatePart, Values,
} from '@salto-io/adapter-api'
import { extractTemplate, replaceTemplatesWithValues, resolveTemplates } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../../filter'

const { awu } = collections.asynciterable
const log = logger(module)
const REFERENCE_MARKER_REGEX = /(\{\{)(.+?)(}})/


type Component = Record<string, Values>
const simpleIssueRegex = new RegExp(/issue\.[a-zA-Z ]+(?: |$)/, 'g')
const issueFieldNameToTypeMapping: Record<string, string> = {
  key: 'Key',
  project: 'Project',
  status: 'Status',
  summary: 'Summary',
  versions: 'Affects versions',
  resolution: 'Resolution',
  updated: 'Updated',
  'Story Points': 'Story Points',
  'Story Points estimate': 'Story Points estimate',
  created: 'Created',
  duedate: 'Due Date',
}

const issueTypeNameToFieldMapping = Object.fromEntries(
  Object.entries(issueFieldNameToTypeMapping).map(([k, v]) => [v, k])
)

const getAutomations = (instances: InstanceElement[]): InstanceElement[] =>
  instances.filter(instance => instance.elemID.typeName === 'Automation')

// This function receives a string that contains issue references and replaces
// it with salto style templates.
const stringToTemplate = (referenceSt: string,
  fieldsByName: Record<string, InstanceElement>): TemplateExpression | string => {
  const handleJiraReference = (expression: string, ref: RegExpMatchArray): TemplatePart => {
    const referenceArr = (ref.pop() ?? '').split('.')
    if (referenceArr.length === 2) {
      const elem = fieldsByName[issueFieldNameToTypeMapping[referenceArr[1]] ?? referenceArr[1]]
      if (elem) {
        return new ReferenceExpression(elem.elemID, elem)
      }
    }
    // if no id was detected we return the original expression.
    return expression
  }
  return extractTemplate(referenceSt,
    [REFERENCE_MARKER_REGEX],
    expression => {
      const jiraReference = expression.match(simpleIssueRegex)
      if (jiraReference) {
        return handleJiraReference(expression, jiraReference)
      }
      return expression
    })
}

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> => {
  try {
    getAutomations(instances).forEach(instance => {
      const fieldsByName = _.keyBy(instances.filter(i => i.elemID.typeName === 'Field'
        && _.isString(i.value.name)), (i: InstanceElement): string =>
        i.value.name);
      (instance.value.components ?? []).forEach((component: Component) => {
        const { value } = component
        if (value) {
          Object.keys(value).filter(k => _.isString(value[k])).forEach(k => {
            value[k] = stringToTemplate(value[k], fieldsByName)
          })
        }
      })
    })
  } catch (e) {
    log.error(`Error parsing templates in deployment: ${e.message}`)
  }
}

const prepRef = (part: ReferenceExpression): TemplatePart =>
  `issue.${(part.value?.value ? (issueTypeNameToFieldMapping[part.value.value.name]
    ?? part?.value?.value?.name) : '')}`

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 */
const filterCreator: FilterCreator = () => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: Element[]): Promise<void> => log.time(async () =>
      replaceFormulasWithTemplates(elements.filter(isInstanceElement)), 'Create template creation filter'),
    preDeploy: (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () => {
      try {
        (getAutomations(await awu(changes).map(getChangeData).toArray())).forEach(
          async instance => (instance.value.components ?? []).forEach((component: Component) => {
            if (component.value) {
              Object.keys(component.value).forEach(k => {
                replaceTemplatesWithValues({ fieldName: k, values: [component.value] },
                  deployTemplateMapping, prepRef)
              })
            }
          })
        )
      } catch (e) {
        log.error(`Error parsing templates in deployment: ${e.message}`)
      }
    }, 'Create template resolve filter'),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () =>
      (getAutomations(await awu(changes).map(getChangeData).toArray())).forEach(
        async instance => (instance.value.components ?? []).forEach((component: Component) => {
          if (component.value) {
            Object.keys(component.value).forEach(k => {
              resolveTemplates({ fieldName: k, values: [component.value] }, deployTemplateMapping)
            })
          }
        })
      ),
    'Create templates restore filter'),
  })
}

export default filterCreator
