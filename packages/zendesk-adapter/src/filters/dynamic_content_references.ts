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
} from '@salto-io/adapter-api'
import { extractTemplate, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from './dynamic_content'
import { createMissingInstance } from './references/missing_references'
import { ZENDESK } from '../constants'
import { FETCH_CONFIG } from '../config'

const { awu } = collections.asynciterable
const PLACEHOLDER_REGEX = /({{.+?}})/g
const INNER_PLACEHOLDER_REGEX = /{{(.+?)}}/g
const OPEN_BRACKETS = '{{'
const CLOSE_BRACKETS = '}}'

const transformDynamicContentDependencies = async (
  instance: InstanceElement,
  placeholderToItem: Record<string, InstanceElement>,
  enableMissingReference?: boolean,
): Promise<void> => {
  const partToTemplate = (part: string): TemplatePart[] => {
    const placeholder = part.match(INNER_PLACEHOLDER_REGEX)
    if (!placeholder) {
      return [part]
    }
    const itemInstance = placeholderToItem[placeholder[0]]
    if (!itemInstance) {
      if (!enableMissingReference) {
        return [part]
      }
      const matches = placeholder[0].match(/dc\.([a-zA-Z0-9_-]+)\}\}/)
      // matches can return null
      if (!matches || matches.length < 2) {
        return [part]
      }
      const missingInstance = createMissingInstance(
        ZENDESK,
        DYNAMIC_CONTENT_ITEM_TYPE_NAME,
        // matches[1] is the value after the ".", it is caught by the capture group in the regex
        matches[1]
      )
      missingInstance.value.placeholder = `${placeholder[0]}`
      return [
        OPEN_BRACKETS,
        new ReferenceExpression(missingInstance.elemID, missingInstance),
        CLOSE_BRACKETS,
      ]
    }
    return [
      OPEN_BRACKETS,
      new ReferenceExpression(itemInstance.elemID, itemInstance),
      CLOSE_BRACKETS,
    ]
  }
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    transformFunc: ({ value, path }) => {
      if (path && path.name.startsWith('raw_') && _.isString(value)) {
        return extractTemplate(value, [PLACEHOLDER_REGEX], partToTemplate)
      }
      return value
    },
    allowEmpty: true,
  }) ?? instance.value
}

const templatePartToApiValue = (allParts: TemplatePart[]): string =>
  allParts.map(part => {
    if (isReferenceExpression(part)) {
      if (!isInstanceElement(part.value)) {
        return part.value
      }
      if (part.value.value.placeholder?.startsWith(OPEN_BRACKETS)
        && part.value.value.placeholder?.endsWith(CLOSE_BRACKETS)) {
        return part.value.value.placeholder.slice(
          OPEN_BRACKETS.length, -(CLOSE_BRACKETS.length)
        )
      }
    }
    return part
  }).join('')

const returnDynamicContentsToApiValue = async (
  instance: InstanceElement,
  mapping: Record<string, TemplateExpression>,
): Promise<void> => {
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    transformFunc: ({ value, path }) => {
      if (path && path.name.startsWith('raw_') && isTemplateExpression(value)) {
        const transformedValue = templatePartToApiValue(value.parts)
        mapping[transformedValue] = value
        return transformedValue
      }
      return value
    },
    allowEmpty: true,
  }) ?? instance.value
}

/**
 * Add dependencies from elements to dynamic content items in
 * the _generated_ dependencies annotation
 */
const filterCreator: FilterCreator = ({ config }) => {
  const templateMapping: Record<string, TemplateExpression> = {}
  return ({
    name: 'dynamicContentReferencesFilter',
    onFetch: async (elements: Element[]): Promise<void> => {
      const instances = elements.filter(isInstanceElement)

      const placeholderToItem = _(instances)
        .filter(instance => instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME)
        .keyBy(instance => instance.value.placeholder)
        .value()

      await Promise.all(instances.map(instance =>
        transformDynamicContentDependencies(instance, placeholderToItem,
          config[FETCH_CONFIG].enableMissingReferences)))
    },
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      await Promise.all(changes.map(getChangeData).map(instance =>
        returnDynamicContentsToApiValue(instance, templateMapping)))
    },
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> =>
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
          allowEmpty: true,
          strict: false,
        }) ?? instance.value
      }),
  })
}

export default filterCreator
