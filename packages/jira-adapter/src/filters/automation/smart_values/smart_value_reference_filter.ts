/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isTemplateExpression,
  ReferenceExpression,
  SaltoError,
  TemplateExpression,
  TemplatePart,
  Values,
} from '@salto-io/adapter-api'
import {
  createSchemeGuard,
  ERROR_MESSAGES,
  replaceTemplatesWithValues,
  resolveTemplates,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import Joi from 'joi'
import _ from 'lodash'
import { AUTOMATION_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { FIELD_TYPE_NAME } from '../../fields/constants'
import { stringToTemplate } from './template_expression_generator'

const log = logger(module)

const SMART = 'SMART'
const SMART_TYPES = [SMART, 'IQL']

type Component = {
  value?: Values | boolean
  rawValue?: unknown
  children?: Component[]
}

type AutomationInstance = InstanceElement & {
  value: {
    trigger: Component
    components?: Component[]
  }
}

const COMPONENT_SCHEME = Joi.object({
  value: Joi.alternatives(Joi.object(), Joi.boolean()).optional(),
  rawValue: Joi.optional(),
  children: Joi.array().optional(),
}).unknown(true)

const AUTOMATION_INSTANCE_SCHEME = Joi.object({
  value: Joi.object({
    trigger: COMPONENT_SCHEME.required(),
    components: Joi.array().items(COMPONENT_SCHEME).optional(),
  }).unknown(true),
}).unknown(true)

const isAutomationInstance = createSchemeGuard<AutomationInstance>(
  AUTOMATION_INSTANCE_SCHEME,
  'Received an invalid automation',
)

type SmartQuery = {
  type: string
  query: {
    type: string
    value: string
  }
}

const SMART_QUERY_SCHEME = Joi.object({
  type: Joi.string().required(),
  query: Joi.object({
    type: Joi.string().required(),
    value: Joi.string().required(),
  })
    .unknown(true)
    .required(),
})
  .required()
  .unknown(true)

const isSmartQuery = createSchemeGuard<SmartQuery>(SMART_QUERY_SCHEME)

const CUSTOM_SMART_VALUE_SCHEME = Joi.object({
  customSmartValue: SMART_QUERY_SCHEME.required(),
})
  .required()
  .unknown(true)

type CustomSmartValue = {
  customSmartValue: SmartQuery
}

const isCustomSmartValue = createSchemeGuard<CustomSmartValue>(CUSTOM_SMART_VALUE_SCHEME)

const filterAutomations = (instances: InstanceElement[]): AutomationInstance[] =>
  instances.filter(instance => instance.elemID.typeName === AUTOMATION_TYPE).filter(isAutomationInstance)

type SmartValueContainer = { obj: Values; key: string }

const parseSmartQuery = (value: Values, containers: SmartValueContainer[]): void => {
  if (isSmartQuery(value) && SMART_TYPES.includes(value.type) && value.query.type === SMART) {
    containers.push({ obj: value.query, key: 'value' })
  } else if (isCustomSmartValue(value)) {
    parseSmartQuery(value.customSmartValue, containers)
  }
}

const getPossibleSmartValues = (
  automation: AutomationInstance,
  parseAdditionalAutomationExpressions?: boolean,
): SmartValueContainer[] => {
  const containers: SmartValueContainer[] = []

  const findSmartValues = (component: Component): void => {
    if (component.value !== undefined && !_.isBoolean(component.value)) {
      const { value } = component
      if (parseAdditionalAutomationExpressions === true) {
        parseSmartQuery(value, containers)

        if (Array.isArray(value?.operations)) {
          value.operations.forEach(findSmartValues)
        }
      }
      Object.keys(value)
        .filter(key => _.isString(value[key]) || isTemplateExpression(value[key]))
        .map(key => ({ key, obj: value }))
        .forEach(container => containers.push(container))
    }

    if (_.isString(component.rawValue) || isTemplateExpression(component.rawValue)) {
      containers.push({ key: 'rawValue', obj: component })
    }

    if (
      parseAdditionalAutomationExpressions === true &&
      Array.isArray(component.children) &&
      component.children.length > 0
    ) {
      component.children.forEach(findSmartValues)
    }
  }

  ;(automation.value.components ?? []).concat(automation.value.trigger).forEach(component => findSmartValues(component))
  return containers
}

const replaceFormulasWithTemplates = async (
  instances: InstanceElement[],
  parseAdditionalAutomationExpressions?: boolean,
): Promise<SaltoError[]> => {
  const fieldInstances = instances.filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
  const fieldInstancesByName = _(fieldInstances)
    .filter(instance => _.isString(instance.value.name))
    .groupBy(instance => instance.value.name)
    .value()

  const fieldInstancesById = _.keyBy(
    fieldInstances.filter(instance => instance.value.id),
    (instance: InstanceElement): number => instance.value.id,
  )

  const ambiguousTokensWarnings = filterAutomations(instances)
    .map(instance => {
      const allAmbiguousTokens = new Set<string>()
      getPossibleSmartValues(instance, parseAdditionalAutomationExpressions)
        .filter(({ obj, key }) => {
          if (!_.isString(obj[key])) {
            log.debug(`'${key}' in ${instance.elemID.getFullName()} key is not a string`)
            return false
          }
          return true
        })
        .forEach(({ obj, key }) => {
          try {
            const { template, ambiguousTokens } = stringToTemplate({
              referenceStr: obj[key],
              fieldInstancesByName,
              fieldInstancesById,
            })
            obj[key] = template
            ambiguousTokens.forEach(token => allAmbiguousTokens.add(token))
          } catch (e) {
            log.error(`Error parsing templates in fetch ${e}, stack: ${e.stack}`)
          }
        })

      if (allAmbiguousTokens.size === 0) {
        return undefined
      }

      return {
        message: ERROR_MESSAGES.OTHER_ISSUES,
        detailedMessage: `Automation ${instance.elemID.getFullName()} has smart values that cannot be translated to a Salto reference because there is more than one field with the token name and there is no way to tell which one is applied. The ambiguous tokens: ${Array.from(allAmbiguousTokens).join(', ')}.`,
        severity: 'Warning' as const,
      }
    })
    .filter(values.isDefined)

  return ambiguousTokensWarnings
}

const prepRef = (part: ReferenceExpression): TemplatePart => {
  if (part.elemID.isTopLevel()) {
    return part.value.value.id
  }
  if (!_.isString(part.value)) {
    throw new Error(
      `Received an invalid value inside a template expression ${part.elemID.getFullName()}: ${safeJsonStringify(part.value)}`,
    )
  }
  return part.value
}

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 */
const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'smartValueReferenceFilter',
    onFetch: async (elements: Element[]) => {
      const { parseTemplateExpressions, parseAdditionalAutomationExpressions } = config.fetch
      if (parseTemplateExpressions === false) {
        log.debug('Parsing smart values template expressions was disabled')
        return {}
      }
      const warnings = await replaceFormulasWithTemplates(
        elements.filter(isInstanceElement),
        parseAdditionalAutomationExpressions,
      )
      return {
        errors: warnings,
      }
    },

    preDeploy: async (changes: Change<InstanceElement>[]) => {
      filterAutomations(changes.map(getChangeData))
        .filter(isInstanceElement)
        .forEach(instance =>
          getPossibleSmartValues(instance, config.fetch.parseAdditionalAutomationExpressions).forEach(
            ({ obj, key }) => {
              try {
                replaceTemplatesWithValues({ values: [obj], fieldName: key }, deployTemplateMapping, prepRef)
              } catch (e) {
                log.error('Error parsing templates in deployment', e)
              }
            },
          ),
        )
    },

    onDeploy: async (changes: Change<InstanceElement>[]) => {
      filterAutomations(changes.map(getChangeData))
        .filter(isInstanceElement)
        .forEach(instance =>
          getPossibleSmartValues(instance, config.fetch.parseAdditionalAutomationExpressions).forEach(
            ({ obj, key }) => {
              try {
                resolveTemplates({ values: [obj], fieldName: key }, deployTemplateMapping)
              } catch (e) {
                log.error('Error restoring templates in deployment', e)
              }
            },
          ),
        )
    },
  }
}

export default filterCreator
