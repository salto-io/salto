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
import { AUTOMATION_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { FIELD_TYPE_NAME } from '../fields/constants'

const { awu } = collections.asynciterable
const log = logger(module)
const REFERENCE_MARKER_REGEX = /(\{\{)(.+?)(}})/


type Component = Record<string, Values>
// A simple issue reference looks like issue.FOO, where FOO can contain spaces,
// like issue.Story Points
const SIMPLE_ISSUES_REGEX = new RegExp(/issue\.[a-zA-Z ]+(?: |$)/, 'g')
// These are known mappings between system fields and their "name" property
const ISSUE_FIELD_NAME_TO_TYPE_MAPPING: Record<string, string> = {
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

const ISSUE_TYPE_NAME_TO_FIELD_MAPPING = _.invert(ISSUE_FIELD_NAME_TO_TYPE_MAPPING)

const getAutomations = (instances: InstanceElement[]): InstanceElement[] =>
  instances.filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)

// This function receives a string that contains issue references and replaces
// it with salto style templates.
const stringToTemplate = (
  referenceStr: string,
  fieldsByName: Record<string, InstanceElement>,
): TemplateExpression | string => {
  const handleJiraReference = (expression: string, ref: RegExpMatchArray): TemplatePart => {
    // ref.pop() will return the result of the regex, which should be something like issue.*****
    // where **** might map onto a field name
    const referenceArr = (ref.pop() ?? '').split('.')
    if (referenceArr.length === 2) {
      // if a field doesn't exist in the mapping, it could be a custom field,
      // so we try to look for that.
      const elem = fieldsByName[ISSUE_FIELD_NAME_TO_TYPE_MAPPING[referenceArr[1]]
        ?? referenceArr[1]]
      if (elem) {
        return new ReferenceExpression(elem.elemID, elem)
      }
    }
    // if no id was detected we return the original expression.
    return expression
  }
  return extractTemplate(
    referenceStr,
    [REFERENCE_MARKER_REGEX],
    expression => {
      const jiraReference = expression.match(SIMPLE_ISSUES_REGEX)
      if (jiraReference) {
        return handleJiraReference(expression, jiraReference)
      }
      return expression
    },
  )
}

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> => {
  const fieldsByName = _.keyBy(instances.filter(instance =>
    instance.elemID.typeName === FIELD_TYPE_NAME
      && _.isString(instance.value.name)), (instance: InstanceElement): string =>
    instance.value.name)
  getAutomations(instances).forEach(instance => {
    (instance.value.components ?? []).forEach((component: Component) => {
      try {
        const { value } = component
        if (value) {
          Object.keys(value).filter(key => _.isString(value[key])).forEach(key => {
            value[key] = stringToTemplate(value[key], fieldsByName)
          })
        }
      } catch (e) {
        log.error('Error parsing templates in fetch', e)
      }
    })
  })
}

const prepRef = (part: ReferenceExpression): TemplatePart => {
  if (part.value?.value?.name) {
    const { name } = part.value.value
    return `issue.${ISSUE_TYPE_NAME_TO_FIELD_MAPPING[name] ?? name}`
  }
  return ''
}

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 */
const filterCreator: FilterCreator = () => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: Element[]) => log.time(async () =>
      replaceFormulasWithTemplates(elements.filter(isInstanceElement)), 'Template creation filter'),
    preDeploy: (changes: Change<InstanceElement>[]) => log.time(async () => {
      await (Promise.all(getAutomations(await awu(changes).map(getChangeData).toArray())
        .filter(isInstanceElement).flatMap(
          async instance => (instance.value.components ?? [])
            .flatMap(async (component: Component) => {
              try {
                if (component.value) {
                  Object.keys(component.value).forEach(k => {
                    replaceTemplatesWithValues({ fieldName: k, values: [component.value] },
                      deployTemplateMapping, prepRef)
                  })
                }
              } catch (e) {
                log.error('Error parsing templates in deployment', e)
              }
            })
        )))
    }, 'Template resolve filter'),
    onDeploy: async (changes: Change<InstanceElement>[]) => log.time(async () => {
      await (Promise.all(getAutomations(await awu(changes).map(getChangeData).toArray())
        .filter(isInstanceElement).flatMap(
          async instance => (instance.value.components ?? [])
            .flatMap(async (component: Component) => {
              try {
                if (component.value) {
                  Object.keys(component.value).forEach(k => {
                    resolveTemplates({ fieldName: k, values: [component.value] },
                      deployTemplateMapping)
                  })
                }
              } catch (e) {
                log.error('Error restoring templates in deployment', e)
              }
            })
        )))
    }, 'Templates restore filter'),
  })
}

export default filterCreator
