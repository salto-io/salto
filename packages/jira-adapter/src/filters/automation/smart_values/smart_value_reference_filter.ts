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
import { replaceTemplatesWithValues, resolveTemplates } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { AUTOMATION_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { FIELD_TYPE_NAME } from '../../fields/constants'
import { stringToTemplate } from './template_expression_generator'

const { awu } = collections.asynciterable
const log = logger(module)


type Component = {
  value?: Values
  rawValue?: unknown
}

const filterAutomations = (instances: InstanceElement[]): InstanceElement[] =>
  instances.filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)

const replaceFormulasWithTemplates = async (instances: InstanceElement[]): Promise<void> => {
  const fieldInstances = instances.filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
  const fieldInstancesByName = _.keyBy(fieldInstances.filter(instance => _.isString(instance.value.name)),
    (instance: InstanceElement): string => instance.value.name)
  const fieldsById = _.keyBy(fieldInstances.filter(instance => instance.value.id),
    (instance: InstanceElement): number => instance.value.id)
  filterAutomations(instances).forEach(instance => {
    [...(instance.value.components ?? []), instance.value.trigger]
      .forEach((component: Component) => {
        try {
          const { value } = component
          if (value !== undefined && _.isPlainObject(value)) {
            Object.keys(value).filter(key => _.isString(value[key])).forEach(key => {
              value[key] = stringToTemplate(value[key], fieldInstancesByName, fieldsById)
            })
          }

          if (component.rawValue !== undefined && _.isString(component.rawValue)) {
            component.rawValue = stringToTemplate(
              component.rawValue,
              fieldInstancesByName,
              fieldsById
            )
          }
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
  return part.value
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
      await (Promise.all(filterAutomations(await awu(changes).map(getChangeData).toArray())
        .filter(isInstanceElement).flatMap(
          async instance => [...(instance.value.components ?? []), instance.value.trigger]
            .flatMap(async component => {
              try {
                if (_.isPlainObject(component.value)) {
                  Object.keys(component.value).forEach(k => {
                    replaceTemplatesWithValues(
                      { fieldName: k, values: [component.value] },
                      deployTemplateMapping,
                      prepRef
                    )
                  })
                }
                replaceTemplatesWithValues(
                  { fieldName: 'rawValue', values: [component] },
                  deployTemplateMapping,
                  prepRef
                )
              } catch (e) {
                log.error('Error parsing templates in deployment', e)
              }
            })
        )))
    }, 'Template resolve filter'),

    onDeploy: async (changes: Change<InstanceElement>[]) => log.time(async () => {
      await (Promise.all(filterAutomations(await awu(changes).map(getChangeData).toArray())
        .filter(isInstanceElement).flatMap(
          async instance => [...(instance.value.components ?? []), instance.value.trigger]
            .flatMap(async component => {
              try {
                if (component.value) {
                  Object.keys(component.value).forEach(k => {
                    resolveTemplates(
                      { fieldName: k, values: [component.value] },
                      deployTemplateMapping
                    )
                  })
                }
                resolveTemplates(
                  { fieldName: 'rawValue', values: [component] },
                  deployTemplateMapping
                )
              } catch (e) {
                log.error('Error restoring templates in deployment', e)
              }
            })
        )))
    }, 'Templates restore filter'),
  })
}

export default filterCreator
