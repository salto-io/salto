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
  Element, InstanceElement, isInstanceElement, ReferenceExpression,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies, FlatDetailedDependency, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { strings, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from './dynamic_content'

const PLACEHOLDER_REGEX = /{{.+?}}/g

const extractPlaceholders = (value: string): string[] =>
  _.uniq(Array.from(strings.matchAll(value, PLACEHOLDER_REGEX)).map(match => match[0]))

const getDynamicContentDependencies = (
  instance: InstanceElement,
  placeholderToItem: Record<string, InstanceElement>
): FlatDetailedDependency[] => {
  const dependencies: FlatDetailedDependency[] = []
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.name.startsWith('raw_') && typeof value === 'string') {
        dependencies.push(
          ...extractPlaceholders(value)
            .map(placeholder => placeholderToItem[placeholder])
            .filter(values.isDefined)
            .map(itemInstance => ({
              reference: new ReferenceExpression(itemInstance.elemID, itemInstance),
              location: new ReferenceExpression(path, value),
            }))
        )
      }

      return WALK_NEXT_STEP.RECURSE
    },
  })

  return dependencies
}

/**
 * Add dependencies from elements to dynamic content items in
 * the _generated_ dependencies annotation
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement)

    const placeholderToItem = _(instances)
      .filter(instance => instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME)
      .keyBy(instance => instance.value.placeholder)
      .value()

    instances.forEach(instance => {
      const dependencies = getDynamicContentDependencies(instance, placeholderToItem)
      extendGeneratedDependencies(instance, dependencies)
    })
  },
})

export default filterCreator
