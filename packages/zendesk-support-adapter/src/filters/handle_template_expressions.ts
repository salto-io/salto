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
import _ from 'lodash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable
const log = logger(module)

type PotentialTemplateField = {
  instanceType: string
  pathToContainer?: string[]
  fieldName: string
  containerValidator: (container: Values) => boolean
}

const zendeskReferenceTypeToSaltoType: Record<string, string> = {
  'ticket.ticket_field': 'ticket_field',
  'ticket.ticket_field_option_title': 'ticket_field__custom_field_options',
}

const saltoTypeToZendeskReferenceType = Object.fromEntries(
  Object.entries(zendeskReferenceTypeToSaltoType)
    .map(entry => [entry[1], entry[0]])
)

const potentialReferenceTypes = ['ticket.ticket_field', 'ticket.ticket_field_option_title']
const potentialMacroFields = ['comment_value', 'comment_value_html']
const potentialTriggerFields = ['notification_webhook', 'notification_user']
const NoValidator = (): boolean => true
const potentialTemplates: PotentialTemplateField[] = [
  {
    instanceType: 'macro',
    pathToContainer: ['actions'],
    fieldName: 'value',
    containerValidator: (container: Values): boolean =>
      potentialMacroFields.includes(container.field),
  },
  {
    instanceType: 'target',
    fieldName: 'target_url',
    containerValidator: NoValidator,
  },
  {
    instanceType: 'webhook',
    fieldName: 'endpoint',
    containerValidator: NoValidator,
  },
  {
    instanceType: 'trigger',
    pathToContainer: ['actions'],
    fieldName: 'value',
    containerValidator: (container: Values): boolean =>
      potentialTriggerFields.includes(container.field),
  },
]

// This function receives a formula that contains zendesk-style references and replaces
// it with salto style templates.
const formulaToTemplate = (formula: string,
  instancesByType: Record<string, InstanceElement[]>): TemplateExpression | string => {
  let formulaWithDetectedParts = formula
  // The first part of the regex identifies ids, with the pattern {some_id_field_1234}
  // The replace flags the pattern with a reference-like string to avoid the later code from
  // detecting ids in numbers that are not marked as ids.
  potentialReferenceTypes.forEach(type => {
    formulaWithDetectedParts = formulaWithDetectedParts
      // eslint-disable-next-line no-template-curly-in-string
      .replace(new RegExp(`({{)(${type}_[\\d]+?)(}})`, 'g'), '$1$${$2}$3')
  })
  // The second part is a split that separates the now-marked ids, so they could be replaced
  // with ReferenceExpression in the loop code.
  const templateParts = formulaWithDetectedParts
    .split(/(\$\{.+?_[\d]+?\})/).filter(e => e !== '')
    .map(expression => {
      const zendeskReference = expression.match(/\$\{(.+?)_([\d]+?)\}/)
      if (zendeskReference) {
        // last group in the stack contains the id of reference.
        // Both these variables can't be empty but we check for typescript
        const innerId = zendeskReference.pop() ?? ''
        // group that entered before it contains type.
        const type = zendeskReference.pop() ?? ''
        const ref = (instancesByType[zendeskReferenceTypeToSaltoType[type] ?? ''] ?? [])
          .find(instance => instance.value.id?.toString() === innerId)
        if (ref) {
          return new ReferenceExpression(ref.elemID, ref)
        }
        // if no id was detected we return these parts that will later be joined to
        // create the original string.
        return `${type}_${innerId}`
      }
      return expression
    })
  if (templateParts.every(_.isString)) {
    return templateParts.join('')
  }
  return new TemplateExpression({ parts: templateParts })
}

const getContainers = async (instances: InstanceElement[]): Promise<
{ values: Values[]; template: PotentialTemplateField }[]
> =>
  instances.map(instance =>
    potentialTemplates.filter(
      t => instance.elemID.typeName === t.instanceType
    ).map(template => ({
      template,
      values: [
        template.pathToContainer
          ? _.get(instance.value, template.pathToContainer, [])
          : instance.value,
      ].flat().filter(template.containerValidator),
    }))).flat()

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> =>
  (await getContainers(instances)).forEach(container => {
    const { fieldName } = container.template
    const instancesByType = _.groupBy(instances, i => i.elemID.typeName)
    container.values.forEach(value => {
      if (Array.isArray(value[fieldName])) {
        value[fieldName] = value[fieldName].map((innerValue: unknown) =>
          (_.isString(innerValue) ? formulaToTemplate(innerValue, instancesByType) : innerValue))
      } else if (value[fieldName]) {
        value[fieldName] = formulaToTemplate(value[fieldName], instancesByType)
      }
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
    preDeploy: (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () => {
      (await getContainers(await awu(changes).map(getChangeData).toArray())).forEach(
        async container => {
          const { fieldName } = container.template
          const handleTemplateValue = (template: TemplateExpression): string => {
            const templateUsingIdField = new TemplateExpression({
              parts: template.parts.map(part => (isReferenceExpression(part)
                ? [saltoTypeToZendeskReferenceType[part.elemID.typeName],
                  '_',
                  new ReferenceExpression(part.elemID.createNestedID('id'), part.value.value.id)]
                : part)).flat(),
            })
            deployTemplateMapping[templateUsingIdField.value] = template
            return templateUsingIdField.value
          }
          const replaceIfTemplate = (value: unknown): unknown =>
            (isTemplateExpression(value) ? handleTemplateValue(value) : value)
          container.values.forEach(value => {
            if (Array.isArray(value[fieldName])) {
              value[fieldName] = value[fieldName].map(replaceIfTemplate)
            } else {
              value[fieldName] = replaceIfTemplate(value[fieldName])
            }
          })
        }
      )
    }, 'Create template resolve filter'),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () =>
      (await getContainers(await awu(changes).map(getChangeData).toArray()))
        .forEach(async container => {
          const { fieldName } = container.template
          const restoreTemplate = (v: string): string | TemplateExpression =>
            deployTemplateMapping[v] ?? v
          container.values.forEach(value => {
            value[fieldName] = restoreTemplate(value[fieldName])
          })
        }), 'Create templates restore filter'),
  })
}

export default filterCreator
