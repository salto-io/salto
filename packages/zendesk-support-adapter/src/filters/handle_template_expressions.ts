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
  Change, Element, getChangeData, InstanceElement, isInstanceElement, isReferenceExpression,
  isTemplateExpression, ReferenceExpression, TemplateExpression, TemplatePart, Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { isArray, isString } from 'lodash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable
const log = logger(module)

const formulaToTemplate = (formula: string,
  instances: InstanceElement[]): TemplateExpression | string => {
  const templateParts = formula.split(/({{.+?_[\d]+?}})/).filter(e => e !== '')
    .map(expression => {
      if (!expression.startsWith('{{') || !expression.endsWith('}}')) {
        return expression
      }
      const parts: TemplatePart[] = expression.substring(0, expression.length - 2).split('_')
      const internalId = parts[parts.length - 1]
      const ref = instances.find(e => `${e.value.id}` === internalId)
      if (ref) {
        parts[parts.length - 1] = new ReferenceExpression(ref.elemID)
      }
      return [parts.slice(0, parts.length - 1).join('_'), '_', parts[parts.length - 1], '}}']
    }).flat()
  if (templateParts.every(isString)) {
    return templateParts.join('')
  }
  return new TemplateExpression({ parts: templateParts })
}

const isMacro = async (i: InstanceElement): Promise<boolean> =>
  (await i.getType()).elemID.typeName === 'macro'

const getActions = async (instances: InstanceElement[]): Promise<Values[]> =>
  instances.filter(isMacro).map(macro => macro.value.actions ?? []).flat()

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> =>
  (await getActions(instances)).forEach(action => {
    if (isArray(action.value) && action.value.every(isString)) {
      action.value = action.value.map((e: string) => formulaToTemplate(e, instances))
    }
    if (isString(action.value)) {
      action.value = formulaToTemplate(action.value, instances)
    }
  })

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 * the _generated_ dependencies annotation
 */
const filterCreator: FilterCreator = () => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: Element[]): Promise<void> => log.time(async () =>
      replaceFormulasWithTemplates(elements.filter(isInstanceElement)), 'Create template creation filter'),
    preDeploy: (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () =>
      (await getActions(await awu(changes).map(getChangeData).toArray())).forEach(async action => {
        const { value } = action
        const handleTemplateValue = (template: TemplateExpression): string => {
          const templateUsingIdField = new TemplateExpression({
            parts: template.parts.map(part => (isReferenceExpression(part)
              ? new ReferenceExpression(part.elemID.createNestedID('id'), part.value.value.id)
              : part)),
          })
          deployTemplateMapping[templateUsingIdField.value] = template
          return templateUsingIdField.value
        }
        if (isTemplateExpression(value)) {
          action.value = handleTemplateValue(value)
        }
        if (isArray(value)) {
          action.value = value.map(v => handleTemplateValue(v))
        }
      }), 'Create template resolve filter'),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () => {
      (await getActions(await awu(changes).map(getChangeData).toArray())).forEach(async action => {
        const { value } = action
        const restoreTemplate = (v: string): string | TemplateExpression =>
          deployTemplateMapping[v] ?? v
        if (isString(value)) {
          action.value = restoreTemplate(value)
        }
        if (isArray(value)) {
          action.value = value.map(v => restoreTemplate(v))
        }
      })
    }, 'Create templates restore filter'),
  })
}

export default filterCreator
