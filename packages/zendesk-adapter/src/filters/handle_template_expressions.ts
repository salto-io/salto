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
import {
  Change, Element, getChangeData, InstanceElement, isInstanceElement,
  ReferenceExpression, TemplateExpression, TemplatePart, Values,
} from '@salto-io/adapter-api'
import { extractTemplate, TemplateContainer, replaceTemplatesWithValues, resolveTemplates } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from './dynamic_content'
import { createMissingInstance } from './references/missing_references'
import {
  ZENDESK,
  TICKET_FIELD_TYPE_NAME,
  ORG_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME,
} from '../constants'
import { FETCH_CONFIG } from '../config'


const { awu } = collections.asynciterable
const log = logger(module)
const BRACKETS = [['{{', '}}'], ['{%', '%}']]
const REFERENCE_MARKER_REGEX = /\$\{(.+?)}/
const DYNAMIC_CONTENT_REGEX = /(dc\.[\w-]+)/g
export const TICKET_TICKET_FIELD = 'ticket.ticket_field'
export const TICKET_FIELD_OPTION_TITLE = 'ticket.ticket_field_option_title'
export const ORGANIZATION_FIELD = 'ticket.organization.custom_fields'
export const USER_FIELD = 'ticket.requester.custom_fields'
const ID = 'id'
const KEY = 'key'
const KEY_FIELDS = [ORGANIZATION_FIELD, USER_FIELD]

export const ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE: Record<string, string> = {
  [TICKET_TICKET_FIELD]: TICKET_FIELD_TYPE_NAME,
  [TICKET_FIELD_OPTION_TITLE]: TICKET_FIELD_TYPE_NAME,
  [ORGANIZATION_FIELD]: ORG_FIELD_TYPE_NAME,
  [USER_FIELD]: USER_FIELD_TYPE_NAME,
}

const ZENDESK_TYPE_TO_FIELD: Record<string, string> = {
  [TICKET_TICKET_FIELD]: ID,
  [TICKET_FIELD_OPTION_TITLE]: ID,
  [ORGANIZATION_FIELD]: KEY,
  [USER_FIELD]: KEY,
}

const POTENTIAL_REFERENCE_TYPES = Object.keys(ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE)
const typeSearchRegexes: RegExp[] = []
BRACKETS.forEach(([opener, closer]) => {
  POTENTIAL_REFERENCE_TYPES.forEach(type => {
    typeSearchRegexes.push(new RegExp(`(${opener})([^\\$}]*${type}_[\\d]+[^}]*)(${closer})`, 'g'))
  })
  // dynamic content references look different, but can still be part of template
  typeSearchRegexes.push(new RegExp(`(${opener})([^\\$}]*dc\\.[\\w]+[^}]*)(${closer})`, 'g'))
})
const potentialReferenceTypeRegex = new RegExp(`((?:${POTENTIAL_REFERENCE_TYPES.join('|')})(?:_[\\d]+|\\.[^ \\}]+))`, 'g')
const potentialMacroFields = [
  'comment_value', 'comment_value_html', 'side_conversation', 'side_conversation_ticket', 'subject', 'side_conversation_slack',
]
// triggers and automations notify users, webhooks
// groups or targets with text that can include templates.
const notificationTypes = ['notification_webhook', 'notification_user', 'notification_group', 'notification_target']

type PotentialTemplateField = {
  instanceType: string
  pathToContainer?: string[]
  fieldName: string
  containerValidator: (container: Values) => boolean
}

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
  typeSearchRegexes.forEach(regex => {
    // The first part of the regex identifies ids, with the pattern {some_id_field_1234}
    // The replace flags the pattern with a reference-like string to avoid the later code from
    // detecting ids in numbers that are not marked as ids.
    // eslint-disable-next-line no-template-curly-in-string
    formulaWithDetectedParts = formulaWithDetectedParts.replace(regex, '$1$${$2}$3')
  })
  return formulaWithDetectedParts
}

// This function receives a formula that contains zendesk-style references and replaces
// it with salto style templates.
const formulaToTemplate = (
  formula: string,
  instancesByType: Record<string, InstanceElement[]>,
  enableMissingReferences?: boolean
): TemplateExpression | string => {
  const handleZendeskReference = (expression: string, ref: RegExpMatchArray): TemplatePart[] => {
    const reference = ref.pop() ?? ''
    const splitReference = reference.split(/(?:_([\d]+))|(?:([^ ]+\.custom_fields)\.)|(?:([^ ]+)\.(title))/).filter(v => !_.isEmpty(v))
    // should be exactly of the form TYPE_INNERID, so should contain exactly two parts
    if (splitReference.length !== 2 && splitReference.length !== 3) {
      return [expression]
    }
    const [type, innerId, title] = splitReference
    const elem = (instancesByType[ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE[type]] ?? [])
      .find(instance => instance.value[ZENDESK_TYPE_TO_FIELD[type]]?.toString() === innerId)
    if (elem) {
      if (KEY_FIELDS.includes(type)) {
        return [
          `${type}.`,
          new ReferenceExpression(elem.elemID, elem),
          title !== undefined ? `.${title}` : '',
        ]
      }
      return [
        `${type}_`,
        new ReferenceExpression(elem.elemID, elem),
      ]
    }
    // if no id was detected we return the original expression.
    if (!enableMissingReferences) {
      return [expression]
    }
    // if no id was detected and enableMissingReferences we return a missing reference expression.
    const missingInstance = createMissingInstance(
      ZENDESK,
      ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE[type],
      innerId
    )
    missingInstance.value[ZENDESK_TYPE_TO_FIELD[type]] = innerId
    if (KEY_FIELDS.includes(type)) {
      return [
        `${type}.`,
        new ReferenceExpression(missingInstance.elemID, missingInstance),
        title !== undefined ? `.${title}` : '',
      ]
    }
    return [
      `${type}_`,
      new ReferenceExpression(missingInstance.elemID, missingInstance),
    ]
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
  // we continuously split the expression to find all kinds of potential references
  return extractTemplate(seekAndMarkPotentialReferences(formula),
    [REFERENCE_MARKER_REGEX, potentialReferenceTypeRegex, DYNAMIC_CONTENT_REGEX],
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
    })
}

const getContainers = async (instances: InstanceElement[]): Promise<TemplateContainer[]> =>
  instances.map(instance =>
    potentialTemplates.filter(
      t => instance.elemID.typeName === t.instanceType
    ).map(template => ({
      fieldName: template.fieldName,
      values: [
        template.pathToContainer
          ? _.get(instance.value, template.pathToContainer, [])
          : instance.value,
      ].flat().filter(template.containerValidator).filter(v => !_.isEmpty(v)),
    }))).flat()

const replaceFormulasWithTemplates = async (
  instances: InstanceElement[], enableMissingReferences?: boolean
): Promise<void> => {
  try {
    (await getContainers(instances)).forEach(container => {
      const { fieldName } = container
      const instancesByType = _.groupBy(instances, i => i.elemID.typeName)
      container.values.forEach(value => {
        if (Array.isArray(value[fieldName])) {
          value[fieldName] = value[fieldName].map((innerValue: unknown) =>
            (_.isString(innerValue)
              ? formulaToTemplate(innerValue, instancesByType, enableMissingReferences)
              : innerValue))
        } else if (value[fieldName]) {
          value[fieldName] = formulaToTemplate(value[fieldName], instancesByType,
            enableMissingReferences)
        }
      })
    })
  } catch (e) {
    log.error(`Error parsing templates in deployment: ${e.message}`)
  }
}

export const prepRef = (part: ReferenceExpression): TemplatePart => {
  if (Object.values(ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE).includes(part.elemID.typeName)) {
    return `${part.value.value.id}`
  }
  if (part.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME
    && _.isString(part.value.value.placeholder)) {
    const placeholder = part.value.value.placeholder.match(DYNAMIC_CONTENT_REGEX)
    return placeholder?.pop() ?? part
  }
  return part
}

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 */
const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: Element[]): Promise<void> => log.time(async () =>
      replaceFormulasWithTemplates(elements.filter(isInstanceElement), config[FETCH_CONFIG].enableMissingReferences), 'Create template creation filter'),
    preDeploy: (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () => {
      try {
        (await getContainers(await awu(changes).map(getChangeData).toArray())).forEach(
          async container => replaceTemplatesWithValues(container, deployTemplateMapping, prepRef)
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
