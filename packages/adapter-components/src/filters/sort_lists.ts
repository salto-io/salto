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
import { collections } from '@salto-io/lowerdash'

import { Element, InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { filter, isResolvedReferenceExpression, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { ApiDefinitions, DefQuery, getNestedWithDefault, queryWithDefault } from '../definitions'
import { ElementFetchDefinition } from '../definitions/system/fetch'

const { awu } = collections.asynciterable

const get = (current: Value, tail: string[]): Value => {
  if (current === undefined) {
    return undefined
  }
  const [head, ...rest] = tail
  const next: Value = _.get(current, head)
  if (isResolvedReferenceExpression(next)) {
    if (rest.length === 0) {
      throw new Error('Cannot sort by reference, use a property of the referenced element')
    }
    return get(next.value, rest)
  }
  if (rest.length === 0) {
    return next
  }
  return get(next, rest)
}

const sortLists = async (instance: InstanceElement, defQuery: DefQuery<ElementFetchDefinition>): Promise<void> => {
  instance.value =
    (await transformValues({
      values: instance.value,
      type: await instance.getType(),
      strict: false,
      allowEmpty: true,
      transformFunc: async ({ value, field }) => {
        if (field === undefined || !Array.isArray(value)) {
          return value
        }
        const fieldCustomizations = defQuery.query(field.parent.elemID.typeName)?.fieldCustomizations
        if (fieldCustomizations === undefined) {
          return value
        }
        const sortFields = fieldCustomizations[field.name]?.sort?.sortByProperties

        if (sortFields !== undefined) {
          _.assign(
            value,
            _.orderBy(
              value,
              sortFields.map((fieldPath: string) => item => get(item, fieldPath.split('.'))),
            ),
          )
        }

        return value
      },
    })) ?? {}
}

/*
 * Sorts lists in instances based on the values of specific fields.
 *
 * The filter uses the field customizations of the instances to determine which fields to sort by.
 * The field customizations should include a `sort` property with a `sortByProperties` array of strings.
 * Each string in the array represents a path to a field in the list elements.
 */
export const sortListsFilterCreator: <TResult extends void | filter.FilterResult, TOptions>() => filter.FilterCreator<
  TResult,
  { definitions: Pick<ApiDefinitions<TOptions>, 'fetch'> }
> =
  () =>
  ({ definitions }) => ({
    name: 'sortListsFilter',
    onFetch: async (elements: Element[]) => {
      const instances = definitions.fetch?.instances
      if (instances === undefined) {
        return
      }
      const defQuery: DefQuery<ElementFetchDefinition> = queryWithDefault(getNestedWithDefault(instances, 'element'))
      await awu(elements)
        .filter(isInstanceElement)
        .forEach(async element => sortLists(element, defQuery))
    },
  })
