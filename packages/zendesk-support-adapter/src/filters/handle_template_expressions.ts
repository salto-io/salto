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
  isTemplateExpression, ReferenceExpression, TemplateExpression, Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { isArray, isString } from 'lodash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable
const log = logger(module)

type PotentialTemplateField = {
  instanceType: string
  pathToContainer: string[]
  fieldName: string
  containerValidator: (container: Values) => boolean
}

const potentialTemplates: PotentialTemplateField[] = [
  {
    instanceType: 'macro',
    pathToContainer: ['actions'],
    fieldName: 'value',
    containerValidator: (container: Values): boolean =>
      container.field === 'comment_value_html',
  },
]

// This function receives a formula that contains zendesk-style references and replaces
// it with salto style templates.
const formulaToTemplate = (formula: string,
  instances: InstanceElement[]): TemplateExpression | string => {
  // Regex explanation:
  // The first part of the regex identifies ids, with the pattern {some_id_field_1234}
  // The replace flags the pattern with a reference-like string to avoid the later code from
  // detecting ids in numbers that are not marked as ids.
  // The second part is a split that separates the now-marked ids, so they could be replaced
  // with ReferenceExpression in the loop code.
  // eslint-disable-next-line no-template-curly-in-string
  const templateParts = formula.replace(/({{.+?_)([\d]+?)(}})/g, '$1$${$2}$3')
    .split(/\$\{([\d]+?)\}/).filter(e => e !== '')
    .map(expression => {
      const ref = instances.find(instance => instance.value.id?.toString() === expression)
      if (ref) {
        return new ReferenceExpression(ref.elemID)
      }
      return expression
    })
  if (templateParts.every(isString)) {
    return templateParts.join('')
  }
  return new TemplateExpression({ parts: templateParts })
}

const getContainersByPath = (root: Values, path: string[]): Values[] => {
  if (path.length === 0 || root[path[0]] === undefined) {
    return []
  }
  if (path.length === 1) {
    return [root[path[0]]].flat()
  }
  if (isArray(root[path[0]])) {
    root[path[0]].map((obj: Values) =>
      getContainersByPath(obj, path.slice(1, path.length))).flat()
    return root[path[0]].map((obj: Values) =>
      getContainersByPath(obj, path.slice(1, path.length))).flat()
  }
  return getContainersByPath(root[path[0]], path.slice(1, path.length))
}

const getContainers = async (instances: InstanceElement[]): Promise<
{ values: Values[]; template: PotentialTemplateField }[]
> =>
  instances.map(instance =>
    potentialTemplates.filter(
      t => instance.elemID.typeName === t.instanceType
    ).map(template => ({
      template,
      values: getContainersByPath(instance.value, template.pathToContainer).filter(
        template.containerValidator
      ),
    }))).flat()

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> =>
  (await getContainers(instances)).forEach(container => {
    const { fieldName } = container.template
    container.values.forEach(value => {
      value[fieldName] = formulaToTemplate(value[fieldName], instances)
    })
  })

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 */
const filterCreator: FilterCreator = () => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: Element[]): Promise<void> => log.time(async () =>
      replaceFormulasWithTemplates(elements.filter(isInstanceElement)), 'Create template creation filter'),
    preDeploy: (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () =>
      (await getContainers(await awu(changes).map(getChangeData).toArray())).forEach(
        async container => {
          const { fieldName } = container.template
          const handleTemplateValue = (template: TemplateExpression): string => {
            const templateUsingIdField = new TemplateExpression({
              parts: template.parts.map(part => (isReferenceExpression(part)
                ? new ReferenceExpression(part.elemID.createNestedID('id'), part.value.value.id)
                : part)),
            })
            deployTemplateMapping[templateUsingIdField.value] = template
            return templateUsingIdField.value
          }
          container.values.forEach(value => {
            if (isTemplateExpression(value[fieldName])) {
              value[fieldName] = handleTemplateValue(value[fieldName])
            }
          })
        }
      ), 'Create template resolve filter'),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () => {
      (await getContainers(await awu(changes).map(getChangeData).toArray()))
        .forEach(async container => {
          const { fieldName } = container.template
          const restoreTemplate = (v: string): string | TemplateExpression =>
            deployTemplateMapping[v] ?? v
          container.values.forEach(value => {
            if (isTemplateExpression(value[fieldName])) {
              value[fieldName] = restoreTemplate(value[fieldName])
            }
          })
        })
    }, 'Create templates restore filter'),
  })
}

export default filterCreator
