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
  isTemplateExpression,
  ReferenceExpression, TemplateExpression, TemplatePart, Values,
} from '@salto-io/adapter-api'
import { createSchemeGuard, replaceTemplatesWithValues, resolveTemplates, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import _ from 'lodash'
import { AUTOMATION_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { FIELD_TYPE_NAME } from '../../fields/constants'
import { stringToTemplate } from './template_expression_generator'

const log = logger(module)


type Component = {
  value?: Values
  rawValue?: unknown
}

type AutomationInstance = InstanceElement & {
  value: {
    trigger: Component
    components?: Component[]
  }
}

const COMPONENT_SCHEME = Joi.object({
  value: Joi.object().optional(),
  rawValue: Joi.optional(),
}).unknown(true)

const AUTOMATION_INSTANCE_SCHEME = Joi.object({
  value: Joi.object({
    trigger: COMPONENT_SCHEME.required(),
    components: Joi.array().items(COMPONENT_SCHEME).optional(),
  }).unknown(true),
}).unknown(true)

const isAutomationInstance = createSchemeGuard<AutomationInstance>(AUTOMATION_INSTANCE_SCHEME, 'Received an invalid automation')

const filterAutomations = (instances: InstanceElement[]): AutomationInstance[] =>
  instances
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .filter(isAutomationInstance)

type SmartValueContainer = { obj: Values; key: string }

const getPossibleSmartValues = (automation: AutomationInstance): SmartValueContainer[] =>
  _(automation.value.components ?? []).concat(automation.value.trigger)
    .flatMap(component => {
      const containers: SmartValueContainer[] = []

      if (component.value !== undefined) {
        const { value } = component
        Object.keys(component.value)
          .filter(key => _.isString(value[key]) || isTemplateExpression(value[key]))
          .map(key => ({
            key,
            obj: value,
          })).forEach(container => containers.push(container))
      }

      if (_.isString(component.rawValue) || isTemplateExpression(component.rawValue)) {
        containers.push({ key: 'rawValue', obj: component })
      }
      return containers
    }).value()

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> => {
  const fieldInstances = instances.filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
  // TODO: handle better multiple fields with the same name (SALTO-2729)
  const fieldInstancesByName = _.keyBy(
    fieldInstances.filter(instance => _.isString(instance.value.name)),
    (instance: InstanceElement): string => instance.value.name
  )
  const fieldInstancesById = _.keyBy(fieldInstances.filter(instance => instance.value.id),
    (instance: InstanceElement): number => instance.value.id)


  filterAutomations(instances).forEach(instance => {
    getPossibleSmartValues(instance)
      .filter(({ obj, key }) => _.isString(obj[key]))
      .forEach(({ obj, key }) => {
        try {
          obj[key] = stringToTemplate({
            referenceStr: obj[key],
            fieldInstancesByName,
            fieldInstancesById,
          })
        } catch (e) {
          log.error('Error parsing templates in fetch', e)
        }
      })
  })
}

const prepRef = (part: ReferenceExpression): TemplatePart => {
  if (part.elemID.isTopLevel()) {
    return part.value.value.id
  }
  if (!_.isString(part.value)) {
    throw new Error(`Received an invalid value inside a template expression ${part.elemID.getFullName()}: ${safeJsonStringify(part.value)}`)
  }
  return part.value
}

/**
 * Process values that can reference other objects and turn them into TemplateExpressions
 */
const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: Element[]) => log.time(async () => {
      if (config.fetch.parseTemplateExpressions === false) {
        log.debug('Parsing smart values template expressions was disabled')
        return
      }
      await replaceFormulasWithTemplates(elements.filter(isInstanceElement))
    }, 'Smart values creation filter'),

    preDeploy: async (changes: Change<InstanceElement>[]) => log.time(() => {
      filterAutomations(changes.map(getChangeData)).filter(isInstanceElement).flatMap(
        async instance => getPossibleSmartValues(instance).forEach(({ obj, key }) => {
          try {
            replaceTemplatesWithValues(
              { values: [obj], fieldName: key },
              deployTemplateMapping,
              prepRef,
            )
          } catch (e) {
            log.error('Error parsing templates in deployment', e)
          }
        })
      )
    }, 'Smart values resolve filter'),

    onDeploy: async (changes: Change<InstanceElement>[]) => log.time(() => {
      filterAutomations(changes.map(getChangeData)).filter(isInstanceElement).flatMap(
        async instance => getPossibleSmartValues(instance).forEach(({ obj, key }) => {
          try {
            resolveTemplates(
              { values: [obj], fieldName: key },
              deployTemplateMapping,
            )
          } catch (e) {
            log.error('Error restoring templates in deployment', e)
          }
        })
      )
    }, 'Smart values restore filter'),
  })
}

export default filterCreator
