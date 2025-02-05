/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { filter, isResolvedReferenceExpression, TransformFuncArgs, transformValuesSync } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { ApiDefinitions, APIDefinitionsOptions, DefQuery, getNestedWithDefault, queryWithDefault } from '../definitions'
import { ElementFetchDefinition } from '../definitions/system/fetch'
import { PropertySortDefinition } from '../definitions/system/fetch/element'

/*
 * Resolve a string path within an instance value.
 *
 * This function recursively resolves the path within the instance value, including hops into
 * values from resolved reference expressions.
 */
const get = (current: Value, tail: string[]): Value => {
  if (isResolvedReferenceExpression(current) || isInstanceElement(current)) {
    if (tail.length === 0) {
      throw new Error('Cannot sort by reference, use a property of the referenced element')
    }
    return get(current.value, tail)
  }
  if (current === undefined || tail.length === 0) {
    return current
  }
  const [head, ...rest] = tail
  return get(_.get(current, head), rest)
}

const sortLists = (instance: InstanceElement, defQuery: DefQuery<ElementFetchDefinition>): void => {
  instance.value =
    transformValuesSync({
      values: instance.value,
      type: instance.getTypeSync(),
      strict: false,
      allowEmptyArrays: true,
      allowExistingEmptyObjects: true,
      transformFunc: ({ value, field }: TransformFuncArgs) => {
        if (field === undefined || !Array.isArray(value)) {
          return value
        }
        const properties = defQuery.query(field.parent.elemID.typeName)?.fieldCustomizations?.[field.name]?.sort
          ?.properties
        if (properties === undefined) {
          return value
        }

        return _.orderBy(
          value,
          properties.map(
            ({ path }: PropertySortDefinition) =>
              (item: Value) =>
                get(item, path.split('.')),
          ),
          properties.map(({ order }: PropertySortDefinition) => order ?? 'asc'),
        )
      },
    }) ?? instance.value
}

/*
 * Sorts list fields in instances based on the values of specific properties.
 *
 * The filter uses the field customizations of the instances to determine which fields to sort by.
 */
export const sortListsFilterCreator: <
  TResult extends void | filter.FilterResult,
  TOptions extends APIDefinitionsOptions,
>() => filter.FilterCreator<TResult, { definitions: Pick<ApiDefinitions<TOptions>, 'fetch'> }> =
  () =>
  ({ definitions }) => ({
    name: 'sortListsFilter',
    onFetch: async (elements: Element[]) => {
      const instances = definitions.fetch?.instances
      if (instances === undefined) {
        return
      }
      const defQuery: DefQuery<ElementFetchDefinition> = queryWithDefault(getNestedWithDefault(instances, 'element'))
      elements.filter(isInstanceElement).forEach((element: InstanceElement) => sortLists(element, defQuery))
    },
  })
