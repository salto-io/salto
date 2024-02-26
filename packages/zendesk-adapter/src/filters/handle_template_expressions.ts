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
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  isTemplateExpression,
  ReferenceExpression,
  TemplateExpression,
  TemplatePart,
  UnresolvedReference,
  Values,
} from '@salto-io/adapter-api'
import {
  extractTemplate,
  TemplateContainer,
  replaceTemplatesWithValues,
  resolveTemplates,
  createTemplateExpression,
} from '@salto-io/adapter-utils'
import { references as referencesUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import {
  ZENDESK,
  TICKET_FIELD_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  GROUP_TYPE_NAME,
  DYNAMIC_CONTENT_ITEM_TYPE_NAME,
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  DEFLECTION_ACTION,
  ARTICLE_TRANSLATION_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
} from '../constants'
import { FETCH_CONFIG, ZendeskConfig } from '../config'
import { ELEMENTS_REGEXES, transformReferenceUrls } from './utils'

const { createMissingInstance } = referencesUtils
const log = logger(module)
const BRACKETS = [
  ['{{', '}}'],
  ['{%', '%}'],
]
const REFERENCE_MARKER_REGEX = /\$\{({{.+?}})\}/
const DYNAMIC_CONTENT_REGEX = /(dc\.[\w-]+)/g
const DYNAMIC_CONTENT_REGEX_WITH_BRACKETS = /({{dc\.[\w-]+}})/g
const TICKET_FIELD_SPLIT = '(?:(ticket.ticket_field|ticket.ticket_field_option_title)_([\\d]+))'
const KEY_SPLIT = '(?:([^ ]+\\.custom_fields)\\.)'
const TITLE_SPLIT = '(?:([^ ]+)\\.(title))'
const SPLIT_REGEX = `${TICKET_FIELD_SPLIT}|${KEY_SPLIT}|${TITLE_SPLIT}`
const ID_KEY_IN_JSON_REGEX = /("id"\s*:\s*\d+)/
export const TICKET_TICKET_FIELD = 'ticket.ticket_field'
export const TICKET_TICKET_FIELD_OPTION_TITLE = 'ticket.ticket_field_option_title'
export const TICKET_ORGANIZATION_FIELD = 'ticket.organization.custom_fields'
export const TICKET_USER_FIELD = 'ticket.requester.custom_fields'
const ID = 'id'
const KEY = 'key'

export const ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE: Record<string, string> = {
  [TICKET_TICKET_FIELD]: TICKET_FIELD_TYPE_NAME,
  [TICKET_TICKET_FIELD_OPTION_TITLE]: TICKET_FIELD_TYPE_NAME,
  [TICKET_ORGANIZATION_FIELD]: ORG_FIELD_TYPE_NAME,
  [TICKET_USER_FIELD]: USER_FIELD_TYPE_NAME,
}

const ZENDESK_TYPE_TO_FIELD: Record<string, string> = {
  [TICKET_FIELD_TYPE_NAME]: ID,
  [ORG_FIELD_TYPE_NAME]: KEY,
  [USER_FIELD_TYPE_NAME]: KEY,
}

const KEY_FIELDS = Object.keys(ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE).filter(
  zendeskReference => ZENDESK_TYPE_TO_FIELD[ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE[zendeskReference]] === KEY,
)

const POTENTIAL_REFERENCE_TYPES = Object.keys(ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE)
const typeSearchRegexes: RegExp[] = []
BRACKETS.forEach(([opener, closer]) => {
  POTENTIAL_REFERENCE_TYPES.forEach(type => {
    typeSearchRegexes.push(new RegExp(`(?<!\\$})(${opener})([\\w]*${type}_[\\d]+[^}]*)(${closer})`, 'g'))
  })
  // dynamic content references look different, but can still be part of template
  typeSearchRegexes.push(new RegExp(`(?<!\\$})(${opener})([\\w]*dc\\.[\\w]+[^}]*)(${closer})`, 'g'))
})

// the potential references will start with one of the POTENTIAL_REFERENCE_TYPES, following either '_<number>' or
// '.<some values that do not include space, '}' or '='> for example:
// ticket.ticket_field_123 and ticket.organization.custom_fields.name_123.title
const potentialReferenceTypeRegex = new RegExp(
  `((?:${POTENTIAL_REFERENCE_TYPES.join('|')})(?:_[\\d]+|\\.[^ \\}\\=]+))`,
  'g',
)
const potentialMacroFields = [
  'comment_value',
  'comment_value_html',
  'side_conversation',
  'side_conversation_ticket',
  'subject',
  'side_conversation_slack',
]
// triggers and automations notify users, webhooks
// groups or targets with text that can include templates.
const notificationTypes = [
  'notification_webhook',
  'notification_user',
  'notification_group',
  'notification_target',
  DEFLECTION_ACTION,
]

const potentialTriggerFields = [...notificationTypes, 'side_conversation_ticket', 'follower']

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
    containerValidator: (container: Values): boolean => potentialMacroFields.includes(container.field),
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
    containerValidator: (container: Values): boolean => potentialTriggerFields.includes(container.field),
  },
  {
    instanceType: 'trigger',
    pathToContainer: ['conditions', 'all'],
    fieldName: 'field',
    containerValidator: NoValidator,
  },
  {
    instanceType: 'trigger',
    pathToContainer: ['conditions', 'any'],
    fieldName: 'field',
    containerValidator: NoValidator,
  },
  {
    instanceType: 'automation',
    pathToContainer: ['actions'],
    fieldName: 'value',
    containerValidator: (container: Values): boolean => notificationTypes.includes(container.field),
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
    containerValidator: (container: Values): boolean => container.name === 'uri_templates',
  },
  {
    instanceType: ARTICLE_TRANSLATION_TYPE_NAME,
    fieldName: 'body',
    containerValidator: NoValidator,
  },
  ...[TICKET_FIELD_TYPE_NAME, CUSTOM_OBJECT_FIELD_TYPE_NAME].flatMap(instanceType => [
    {
      instanceType,
      pathToContainer: ['relationship_filter', 'all'],
      fieldName: 'field',
      containerValidator: NoValidator,
    },
    {
      instanceType,
      pathToContainer: ['relationship_filter', 'any'],
      fieldName: 'field',
      containerValidator: NoValidator,
    },
  ]),
  ...[ORG_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME, TICKET_FIELD_TYPE_NAME, CUSTOM_OBJECT_FIELD_TYPE_NAME].flatMap(
    instanceType => [
      {
        instanceType: `${instanceType}__${CUSTOM_FIELD_OPTIONS_FIELD_NAME}`,
        fieldName: 'raw_name',
        containerValidator: NoValidator,
      },
      {
        instanceType,
        pathToContainer: [CUSTOM_FIELD_OPTIONS_FIELD_NAME],
        fieldName: 'raw_name',
        containerValidator: NoValidator,
      },
    ],
  ),
]

const seekAndMarkPotentialReferences = (formula: string): string => {
  let formulaWithDetectedParts = formula
  typeSearchRegexes.forEach(regex => {
    // The first part of the regex identifies ids, with the pattern {some_id_field_1234}
    // The replace flags the pattern with a reference-like string to avoid the later code from
    // detecting ids in numbers that are not marked as ids.
    // eslint-disable-next-line no-template-curly-in-string
    formulaWithDetectedParts = formulaWithDetectedParts.replace(regex, '${$1$2$3}')
  })
  return formulaWithDetectedParts
}

// This function receives a formula that contains zendesk-style references and replaces
// it with salto style templates.
const formulaToTemplate = ({
  formula,
  instancesByType,
  instancesById,
  enableMissingReferences,
  extractReferencesFromFreeText,
}: {
  formula: string
  instancesByType: Record<string, InstanceElement[]>
  instancesById: Record<string, InstanceElement>
  enableMissingReferences?: boolean
  extractReferencesFromFreeText?: boolean
}): TemplateExpression | string => {
  const handleZendeskReference = (expression: string, ref: RegExpMatchArray): TemplatePart[] => {
    const rawReference = ref.pop() ?? ''
    const reference = rawReference.startsWith('{{') ? rawReference.substring(2, rawReference.length - 2) : rawReference
    const splitReference = reference.split(new RegExp(SPLIT_REGEX)).filter(v => !_.isEmpty(v))
    // should be exactly of the form TYPE_INNERID, or TYPE.name.title so should contain exactly 2 or 3 parts
    if (splitReference.length !== 2 && splitReference.length !== 3) {
      return [expression]
    }
    const [type, innerId, title] = splitReference
    const elem = (instancesByType[ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE[type]] ?? []).find(
      instance =>
        instance.value[ZENDESK_TYPE_TO_FIELD[ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE[type]]]?.toString() === innerId,
    )
    if (elem) {
      if (KEY_FIELDS.includes(type)) {
        return [`${type}.`, new ReferenceExpression(elem.elemID, elem), title !== undefined ? `.${title}` : '']
      }
      return [`${type}_`, new ReferenceExpression(elem.elemID, elem)]
    }
    // if no id was detected we return the original expression.
    if (!enableMissingReferences) {
      return [expression]
    }
    // if no id was detected and enableMissingReferences we return a missing reference expression.
    const missingInstance = createMissingInstance(ZENDESK, ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE[type], innerId)
    missingInstance.value[ZENDESK_TYPE_TO_FIELD[ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE[type]]] = innerId
    if (KEY_FIELDS.includes(type)) {
      return [
        `${type}.`,
        new ReferenceExpression(missingInstance.elemID, missingInstance),
        title !== undefined ? `.${title}` : '',
      ]
    }
    return [`${type}_`, new ReferenceExpression(missingInstance.elemID, missingInstance)]
  }

  const handleDynamicContentReference = (expression: string, ref: RegExpMatchArray): TemplatePart | TemplatePart[] => {
    const dcPlaceholder = ref.pop() ?? ''
    const elem = (instancesByType[DYNAMIC_CONTENT_ITEM_TYPE_NAME] ?? []).find(
      instance => instance.value.placeholder === dcPlaceholder,
    )
    const placeholderNoBrackets = dcPlaceholder.substring(2, dcPlaceholder.length - 2)

    if (elem) {
      return ['{{', new ReferenceExpression(elem.elemID, elem), '}}']
    }

    if (!_.isEmpty(dcPlaceholder) && enableMissingReferences) {
      const missingInstance = createMissingInstance(
        ZENDESK,
        DYNAMIC_CONTENT_ITEM_TYPE_NAME,
        placeholderNoBrackets.startsWith('dc.') ? placeholderNoBrackets.slice(3) : placeholderNoBrackets,
      )
      missingInstance.value.placeholder = dcPlaceholder
      return ['{{', new ReferenceExpression(missingInstance.elemID, missingInstance), '}}']
    }
    return expression
  }

  const potentialRegexes = [REFERENCE_MARKER_REGEX, potentialReferenceTypeRegex, DYNAMIC_CONTENT_REGEX_WITH_BRACKETS]
  if (extractReferencesFromFreeText) {
    potentialRegexes.push(...ELEMENTS_REGEXES.map(s => s.urlRegex))
  }

  // The second part is a split that separates the now-marked ids, so they could be replaced
  // with ReferenceExpression in the loop code.
  // we continuously split the expression to find all kinds of potential references
  return extractTemplate(seekAndMarkPotentialReferences(formula), potentialRegexes, expression => {
    const zendeskReference = expression.match(potentialReferenceTypeRegex)
    if (zendeskReference) {
      return handleZendeskReference(expression, zendeskReference)
    }
    const dynamicContentReference = expression.match(DYNAMIC_CONTENT_REGEX_WITH_BRACKETS)
    if (dynamicContentReference) {
      return handleDynamicContentReference(expression, dynamicContentReference)
    }
    if (extractReferencesFromFreeText) {
      // Check if the expression is a link to a zendesk page without a subdomain
      // href="/hc/en-us/../articles/123123
      const isZendeskLink = new RegExp(`"/?hc/\\S*${_.escapeRegExp(expression)}`).test(formula)
      if (isZendeskLink) {
        return transformReferenceUrls({
          urlPart: expression,
          instancesById,
          enableMissingReferences,
        })
      }
    }
    return expression
  })
}

const getContainers = (instances: InstanceElement[]): TemplateContainer[] =>
  instances
    .map(instance =>
      potentialTemplates
        .filter(t => instance.elemID.typeName === t.instanceType)
        .map(template => ({
          fieldName: template.fieldName,
          values: [template.pathToContainer ? _.get(instance.value, template.pathToContainer, []) : instance.value]
            .flat()
            .filter(template.containerValidator)
            .filter(v => !_.isEmpty(v)),
        })),
    )
    .flat()

const replaceFormulasWithTemplates = ({
  instances,
  enableMissingReferences,
  extractReferencesFromFreeText,
  convertJsonIdsToReferences,
}: {
  instances: InstanceElement[]
  enableMissingReferences?: boolean
  extractReferencesFromFreeText?: boolean
  convertJsonIdsToReferences?: boolean
}): void => {
  const instancesByType = _.groupBy(instances, i => i.elemID.typeName)
  const instancesById = _.keyBy(
    instances.filter(i => _.isNumber(i.value.id)),
    i => _.toString(i.value.id),
  )

  // On deployment, we might want to run the logic to create missing references that weren't created on fetch
  // Because the values are already converted to TempleExpressions, we need to handle them specifically
  const handleTemplateExpressionParts = (parts: TemplatePart[]): TemplateExpression => {
    const newParts = parts.flatMap(part => {
      if (isReferenceExpression(part)) {
        return part
      }
      const template = formulaToTemplate({
        formula: part,
        instancesByType,
        instancesById,
        enableMissingReferences,
        extractReferencesFromFreeText,
      })
      return isTemplateExpression(template) ? template.parts : template
    })
    return createTemplateExpression({ parts: newParts })
  }

  // If a string is a JSON, and it has keys of 'id' with a numeric value - try to convert it to a reference
  const convertIdsInJson = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(innerValue => convertIdsInJson(innerValue))
    }
    if (!_.isString(value)) {
      return value
    }
    try {
      // Checks if this is a JSON string
      JSON.parse(value)
    } catch {
      return value
    }
    return extractTemplate(value, [ID_KEY_IN_JSON_REGEX], expression => {
      if (!ID_KEY_IN_JSON_REGEX.test(expression)) {
        return expression
      }
      const idRegex = /\d+/
      const id = expression.match(idRegex)?.[0]
      // should always be false, used for type check
      if (id === undefined) {
        log.error(`Error parsing id in expression: ${expression}`)
        return expression
      }
      const instance = instancesById[id]
      if (instance === undefined && !enableMissingReferences) {
        return expression
      }

      const expressionWithoutId = expression.replace(idRegex, '')
      const idInstance = instance ?? createMissingInstance(ZENDESK, 'unknown', id)
      return [expressionWithoutId, new ReferenceExpression(idInstance.elemID, idInstance)]
    })
  }

  const formulaToTemplateValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(innerValue => formulaToTemplateValue(innerValue))
    }
    if (isTemplateExpression(value)) {
      return handleTemplateExpressionParts(value.parts)
    }
    return _.isString(value)
      ? formulaToTemplate({
          formula: value,
          instancesByType,
          instancesById,
          enableMissingReferences,
          extractReferencesFromFreeText,
        })
      : value
  }

  try {
    getContainers(instances).forEach(container => {
      const { fieldName } = container
      container.values.forEach(value => {
        // Has to be first because it needs to receive the whole string, not a template expression
        if (convertJsonIdsToReferences) {
          value[fieldName] = convertIdsInJson(value[fieldName])
        }
        value[fieldName] = formulaToTemplateValue(value[fieldName])
      })
    })
  } catch (e) {
    log.error(`Error parsing templates in deployment: ${e.message}`)
  }
}

export const prepRef = (part: ReferenceExpression): TemplatePart => {
  // In some cases this function may run on the .before value of a Change, which may contain unresolved references.
  // .after values are always resolved because unresolved references are dropped by unresolved_references validator
  // This case should be handled more generic but at the moment this is a quick fix to avoid crashing (SALTO-3988)
  // This fix is enough since the .before value is not used in the deployment process
  if (part.value instanceof UnresolvedReference) {
    log.debug(
      'prepRef received a part as unresolved reference, returning an empty string, instance fullName: %s ',
      part.elemID.getFullName(),
    )
    return ''
  }
  if (Object.values(ZENDESK_REFERENCE_TYPE_TO_SALTO_TYPE).includes(part.elemID.typeName)) {
    return `${part.value.value[ZENDESK_TYPE_TO_FIELD[part.elemID.typeName]]}`
  }
  if (part.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME && _.isString(part.value.value.placeholder)) {
    const placeholder = part.value.value.placeholder.match(DYNAMIC_CONTENT_REGEX)
    return placeholder?.pop() ?? part
  }
  if (part.elemID.typeName === GROUP_TYPE_NAME && part.value?.value?.id) {
    return part.value.value.id.toString()
  }
  if (
    [CUSTOM_OBJECT_TYPE_NAME, CUSTOM_OBJECT_FIELD_TYPE_NAME].includes(part.elemID.typeName) &&
    part.value?.value?.key
  ) {
    return part.value.value.key
  }
  if (part.elemID.isTopLevel() && part.value?.value?.id) {
    return part.value.value.id.toString()
  }
  return part
}

export const handleTemplateExpressionsOnFetch = (elements: Element[], config: ZendeskConfig): void => {
  replaceFormulasWithTemplates({
    instances: elements.filter(isInstanceElement),
    ...config[FETCH_CONFIG],
  })
}

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 */
const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'handleTemplateExpressionFilter',
    onFetch: async (elements: Element[]) => handleTemplateExpressionsOnFetch(elements, config),
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      try {
        getContainers(changes.map(getChangeData)).forEach(async container =>
          replaceTemplatesWithValues(container, deployTemplateMapping, prepRef),
        )
      } catch (e) {
        log.error(`Error parsing templates in deployment: ${e.message}`)
      }
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      getContainers(changes.map(getChangeData)).forEach(container => resolveTemplates(container, deployTemplateMapping))
    },
  }
}

export default filterCreator
