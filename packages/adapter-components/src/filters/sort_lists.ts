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

const { awu } = collections.asynciterable

import { Element, InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { filter, isResolvedReferenceExpression, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { AdapterFilterCreator } from '../filter_utils'
import { ApiDefinitions, APIDefinitionsOptions, getNestedWithDefault, queryWithDefault } from '../definitions'
import { ElementFieldCustomization } from '../definitions/system/fetch'
/*
const getValue = (value: Value): Value => (isResolvedReferenceExpression(value) ? value.elemID.getFullName() : value)

 */

const get = (current: Value, tail: string[]): Value => {
  if (current === undefined) {
    return undefined
  }
  const [head, ...rest] = tail
  const next: Value = _.get(current, head)
  if (isResolvedReferenceExpression(next)) {
    if (rest.length === 0) {
      return next.elemID.getFullName()
    }
    return get(next.value, rest)
  }
  if (rest.length === 0) {
    return next
  }
  return get(next, rest)
}

const sortLists = async (
  instance: InstanceElement,
  fieldCustomization?: Record<string, ElementFieldCustomization>,
): Promise<void> => {
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
        const sortFields = fieldCustomization?.[field.name]?.sort?.sortByProperties

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
      const defQuery = queryWithDefault(getNestedWithDefault(instances, 'element'))
      await awu(elements)
        .filter(isInstanceElement)
        .forEach(async element =>
          sortLists(element, (defQuery.query(element.elemID.typeName) as any).fieldCustomizations),
        )
      /*
      await Promise.all(
        elements.filter(isInstanceElement).map(element => async () => {
          defQuery.query(element.elemID.typeName)
          return sortLists(element)
        }),
      )
       */
    },
  })
