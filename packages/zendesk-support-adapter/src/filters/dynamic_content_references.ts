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
  Change,
  Element, getChangeData, InstanceElement, isInstanceElement, isReferenceExpression,
  isTemplateExpression, ReferenceExpression, TemplateExpression, TemplatePart,
} from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from './dynamic_content'

const { awu } = collections.asynciterable
const PLACEHOLDER_REGEX = /({{.+?}})/g
const INNER_PLACEHOLDER_REGEX = /{{(.+?)}}/g
const log = logger(module)

const transformDynamicContentDependencies = async (
  instance: InstanceElement,
  placeholderToItem: Record<string, InstanceElement>
): Promise<void> => {
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    transformFunc: ({ value, path }) => {
      if (path && path.name.startsWith('raw_') && _.isString(value)) {
        const templateParts: TemplatePart[] = value.split(PLACEHOLDER_REGEX).filter(e => e)
          .flatMap(part => {
            const placeholder = part.match(INNER_PLACEHOLDER_REGEX)
            if (!placeholder) {
              return part
            }
            const itemInstance = placeholderToItem[placeholder[0]]
            if (!itemInstance) {
              return part
            }
            return ['{{', new ReferenceExpression(itemInstance.elemID, itemInstance), '}}']
          })
        if (templateParts.every(part => _.isString(part))) {
          return templateParts.join('')
        }
        return new TemplateExpression({ parts: templateParts })
      }
      return value
    },
  }) ?? instance.value
}

const deTransformDynamicContentDependencies = async (
  instance: InstanceElement,
  mapping: Record<string, TemplateExpression>,
): Promise<void> => {
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    transformFunc: ({ value, path }) => {
      if (path && path.name.startsWith('raw_') && isTemplateExpression(value)) {
        const transformedValue = value.parts.map(
          part => {
            // remove brackets because they're included in placeholder
            if (part === '{{') {
              return ''
            }
            if (part === '}}') {
              return ''
            }
            if (isReferenceExpression(part)) {
              if (!isInstanceElement(part.value)) {
                return part
              }
              return part.value.value.placeholder ?? part
            }
            return part
          }
        ).join('')
        mapping[transformedValue] = value
        return transformedValue
      }
      return value
    },
  }) ?? instance.value
}

/**
 * Add dependencies from elements to dynamic content items in
 * the _generated_ dependencies annotation
 */
const filterCreator: FilterCreator = () => {
  const templateMapping: Record<string, TemplateExpression> = {}
  return ({
    onFetch: async (elements: Element[]): Promise<void> => log.time(async () => {
      const instances = elements.filter(isInstanceElement)

      const placeholderToItem = _(instances)
        .filter(instance => instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME)
        .keyBy(instance => instance.value.placeholder)
        .value()

      await Promise.all(instances.map(instance =>
        transformDynamicContentDependencies(instance, placeholderToItem)))
    }, 'Dynamic content references filter'),
    preDeploy: (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () => {
      await Promise.all(changes.map(getChangeData).map(instance =>
        deTransformDynamicContentDependencies(instance, templateMapping)))
    }, 'Dynamic content references filter'),
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => log.time(async () =>
      awu(changes.map(getChangeData)).forEach(async instance => {
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          pathID: instance.elemID,
          transformFunc: ({ value, path }) => {
            if (path && path.name.startsWith('raw_') && _.isString(value)
              && templateMapping[value]) {
              return templateMapping[value]
            }
            return value
          },
        }) ?? instance.value
      }), 'Dynamic content references filter'),
  })
}

export default filterCreator
