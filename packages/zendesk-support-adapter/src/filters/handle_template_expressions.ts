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
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from './dynamic_content'

const { awu } = collections.asynciterable
const log = logger(module)
const BRACKETS = [['{{', '}}'], ['{%', '%}']]
const REFERENCE_MARKER_REGEX = /\$\{(.+?)}/
const DYNAMIC_CONTENT_REGEX = /(dc\.[\w]+)/g


type PotentialTemplateField = {
  instanceType: string
  pathToContainer?: string[]
  fieldName: string
  containerValidator: (container: Values) => boolean
}

type TemplateContainer = {
  values: Values[]
  template: PotentialTemplateField
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
const potentialReferenceTypeRegex = new RegExp(`((?:${potentialReferenceTypes.join('|')})_[\\d]+)`, 'g')
const potentialMacroFields = ['comment_value', 'comment_value_html', 'side_conversation']
// triggers and automations notify users, webhooks
// groups or targets with text that can include templates.
const notificationTypes = ['notification_webhook', 'notification_user', 'notification_group', 'notification_target']

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
    instanceType: 'target',
    fieldName: 'subject',
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
      notificationTypes.includes(container.field),
  },
  {
    instanceType: 'automation',
    pathToContainer: ['actions'],
    fieldName: 'value',
    containerValidator: (container: Values): boolean =>
      notificationTypes.includes(container.field),
  },
  {
    instanceType: 'dynamic_content_item__variants',
    fieldName: 'content',
    containerValidator: NoValidator,
  },
  {
    instanceType: 'app_installation',
    pathToContainer: ['settings'],
    fieldName: 'uri_templates',
    containerValidator: NoValidator,
  },
  {
    instanceType: 'app_installation',
    pathToContainer: ['settings_objects'],
    fieldName: 'value',
    containerValidator: (container: Values): boolean =>
      container.name === 'uri_templates',
  },
]

const seekAndMarkPotentialReferences = (formula: string): string => {
  let formulaWithDetectedParts = formula
  BRACKETS.forEach(([opener, closer]) => {
    // The first part of the regex identifies ids, with the pattern {some_id_field_1234}
    // The replace flags the pattern with a reference-like string to avoid the later code from
    // detecting ids in numbers that are not marked as ids.
    potentialReferenceTypes.forEach(type => {
      formulaWithDetectedParts = formulaWithDetectedParts
        // eslint-disable-next-line no-template-curly-in-string
        .replace(new RegExp(`(${opener})([^\\$}]*${type}_[\\d]+[^}]*)(${closer})`, 'g'), '$1$${$2}$3')
    })
    // dynamic content references look different, but can still be part of template
    formulaWithDetectedParts = formulaWithDetectedParts
    // eslint-disable-next-line no-template-curly-in-string
      .replace(new RegExp(`(${opener})([^\\$}]*dc\\.[\\w]+[^}]*)(${closer})`, 'g'), '$1$${$2}$3')
  })
  return formulaWithDetectedParts
}

// This function receives a formula that contains zendesk-style references and replaces
// it with salto style templates.
const formulaToTemplate = (formula: string,
  instancesByType: Record<string, InstanceElement[]>): TemplateExpression | string => {
  const handleZendeskReference = (expression: string, ref: RegExpMatchArray): TemplatePart => {
    const reference = ref.pop() ?? ''
    const splitReference = reference.split(/_([\d]+)/).filter(v => !_.isEmpty(v))
    if (splitReference.length !== 2) {
      return expression
    }
    const innerId = splitReference[1]
    const type = splitReference[0]
    const elem = (instancesByType[zendeskReferenceTypeToSaltoType[type] ?? ''] ?? [])
      .find(instance => instance.value.id?.toString() === innerId)
    if (elem) {
      return new ReferenceExpression(elem.elemID, elem)
    }
    // if no id was detected we return these parts that will later be joined to
    // create the original string.
    return `${type}_${innerId}`
  }

  const handleDynamicContentReference = (expression: string, ref: RegExpMatchArray):
    TemplatePart => {
    const dcPlaceholder = ref.pop() ?? ''
    const elem = (instancesByType[DYNAMIC_CONTENT_ITEM_TYPE_NAME] ?? []).find(instance =>
      instance.value.placeholder === `{{${dcPlaceholder}}}`)
    if (elem) {
      return new ReferenceExpression(elem.elemID, elem)
    }
    return expression
  }
  // The second part is a split that separates the now-marked ids, so they could be replaced
  // with ReferenceExpression in the loop code.
  const templateParts = seekAndMarkPotentialReferences(formula)
    .split(REFERENCE_MARKER_REGEX).filter(v => !_.isEmpty(v))
    .flatMap(wholeExpression =>
      // we continuously split the expression to find all kinds of potential references
      wholeExpression.split(potentialReferenceTypeRegex).flatMap(
        partiallyParsedExpression => partiallyParsedExpression.split(DYNAMIC_CONTENT_REGEX).flatMap(
          expression => {
            const zendeskReference = expression.match(potentialReferenceTypeRegex)
            if (zendeskReference) {
              return handleZendeskReference(expression, zendeskReference)
            }
            const dynamicContentReference = expression.match(DYNAMIC_CONTENT_REGEX)
            if (dynamicContentReference) {
              return handleDynamicContentReference(expression, dynamicContentReference)
            }
            return expression
          }
        )
      ))
    .filter(v => !_.isEmpty(v))
  if (templateParts.every(_.isString)) {
    return templateParts.join('')
  }
  return new TemplateExpression({ parts: templateParts })
}

const getContainers = async (instances: InstanceElement[]): Promise<TemplateContainer[]> =>
  instances.map(instance =>
    potentialTemplates.filter(
      t => instance.elemID.typeName === t.instanceType
    ).map(template => ({
      template,
      values: [
        template.pathToContainer
          ? _.get(instance.value, template.pathToContainer, [])
          : instance.value,
      ].flat().filter(template.containerValidator).filter(v => !_.isEmpty(v)),
    }))).flat()

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> => {
  try {
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
  } catch (e) {
    log.error(`Error parsing templates in deployment: ${e.message}`)
  }
}

const replaceTemplatesWithValues = async (
  container: TemplateContainer,
  deployTemplateMapping: Record<string, TemplateExpression>
): Promise<void> => {
  const { fieldName } = container.template
  const handleTemplateValue = (template: TemplateExpression): string => {
    const templateUsingIdField = new TemplateExpression({
      parts: template.parts.map(part => {
        if (isReferenceExpression(part)) {
          if (saltoTypeToZendeskReferenceType[part.elemID.typeName]) {
            return [saltoTypeToZendeskReferenceType[part.elemID.typeName],
              '_',
              new ReferenceExpression(part.elemID.createNestedID('id'), part.value.value.id)]
          }
          if (part.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME) {
            if (!isInstanceElement(part.value)) {
              return part
            }
            if (!_.isString(part.value.value.placeholder)) {
              return part
            }
            const placeholder = part.value.value.placeholder.match(DYNAMIC_CONTENT_REGEX)
            return placeholder?.pop() ?? part
          }
        }
        return part
      }).flat(),
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

const resolveTemplates = (
  container: TemplateContainer,
  deployTemplateMapping: Record<string, TemplateExpression>
): void => {
  const { fieldName } = container.template
  const resolveTemplate = (v: string): string | TemplateExpression =>
    deployTemplateMapping[v] ?? v
  container.values.forEach(value => {
    value[fieldName] = resolveTemplate(value[fieldName])
  })
}

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
        (await getContainers(await awu(changes).map(getChangeData).toArray())).forEach(
          async container => replaceTemplatesWithValues(container, deployTemplateMapping)
        )
      } catch (e) {
        log.error(`Error parsing templates in deployment: ${e.message}`)
      }
    }, 'Create template resolve filter'),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () =>
      (await getContainers(changes.map(getChangeData)))
        .forEach(container => resolveTemplates(container, deployTemplateMapping)),
    'Create templates restore filter'),
  })
}

export default filterCreator
