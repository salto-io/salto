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
import _ from 'lodash'
import objectHash from 'object-hash'
import { ElemID, Values, isPrimitiveValue } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementQuery } from '../query'
import { Requester } from '../request/requester'
import { TypeResourceFetcher, ValueGeneratedItem } from '../types'
import { DefQuery } from '../../definitions/system'
import { GeneratedItem } from '../../definitions/system/shared'
import { FetchResourceDefinition } from '../../definitions/system/fetch/resource'
import { recurseIntoSubresources } from './subresources'
import { createValueTransformer } from '../utils'
import { ARG_PLACEHOLDER_MATCHER } from '../request'
import { DependsOnDefinition } from '../../definitions/system/fetch/dependencies'
import { serviceIDKeyCreator } from '../element/id_utils'

const log = logger(module)

export const replaceParams = (origValue: string, paramValues: Record<string, unknown>): string =>
  origValue.replace(ARG_PLACEHOLDER_MATCHER, val => {
    const replacement = _.get(paramValues, val.slice(1, -1)) ?? val
    if (!isPrimitiveValue(replacement)) {
      throw new Error(`Cannot replace param ${val} in ${origValue} with non-primitive value ${replacement}`)
    }
    return replacement.toString()
  })

const calculateContextArgs = ({
  contextDef,
  initialRequestContext,
  contextResources,
}: {
  contextDef?: FetchResourceDefinition['context']
  initialRequestContext?: Record<string, unknown>
  contextResources: Record<string, ValueGeneratedItem[] | undefined>
}): Record<string, unknown[]> => {
  const { dependsOn } = contextDef ?? {}
  const predefinedArgs = _.mapValues(initialRequestContext, collections.array.makeArray)
  const remainingDependsOnArgs: Record<string, DependsOnDefinition> = _.omit(dependsOn, Object.keys(predefinedArgs))

  return _.defaults(
    {},
    predefinedArgs,
    _(remainingDependsOnArgs)
      .mapValues(arg =>
        contextResources[arg.parentTypeName]
          ?.flatMap(item =>
            createValueTransformer<{}, Values>(arg.transformation)({
              typeName: arg.parentTypeName,
              value: { ...item.value, ...item.context },
              context: item.context,
            }),
          )
          .filter(lowerdashValues.isDefined),
      )
      .pickBy(lowerdashValues.isDefined)
      .mapValues(values => _.uniqBy(values, objectHash))
      .value(),
  )
}

export const createTypeResourceFetcher = <ClientOptions extends string>({
  adapterName,
  typeName,
  resourceDefQuery,
  query,
  requester,
  initialRequestContext,
}: {
  adapterName: string
  typeName: string
  resourceDefQuery: DefQuery<FetchResourceDefinition>
  query: ElementQuery
  requester: Requester<ClientOptions>
  initialRequestContext?: Record<string, unknown>
}): TypeResourceFetcher | undefined => {
  if (!query.isTypeMatch(typeName)) {
    log.info('[%s] type %s does not match query, skipping it and all its dependencies', adapterName, typeName)
    return undefined
  }

  let done = false
  const items: GeneratedItem[] = []

  const getItems: TypeResourceFetcher['getItems'] = () => {
    if (!done) {
      return undefined
    }
    const validItems = _.filter(items, item => lowerdashValues.isPlainObject(item.value)) as ValueGeneratedItem[]
    if (validItems.length < items.length) {
      log.warn(
        '[%s] omitted %d items of type %s that were not plain objects',
        adapterName,
        items.length - validItems.length,
        typeName,
      )
    }

    return validItems
  }

  const fetch: TypeResourceFetcher['fetch'] = async ({ contextResources, typeFetcherCreator }) => {
    const def = resourceDefQuery.query(typeName)
    if (def === undefined) {
      // no requests needed
      return { success: true }
    }

    const contextPossibleArgs = calculateContextArgs({
      contextDef: def.context,
      initialRequestContext,
      contextResources,
    })
    try {
      const itemsWithContext = await requester.requestAllForResource({
        callerIdentifier: { typeName },
        contextPossibleArgs,
      })

      const recurseIntoFetcher = recurseIntoSubresources({ def, typeFetcherCreator, contextResources })

      const allFragments = await Promise.all(
        itemsWithContext.map(async item => {
          const nestedResources = await recurseIntoFetcher(item)
          const fieldValues = Object.entries(nestedResources).map(([fieldName, fieldItems]) => ({
            [fieldName]: Array.isArray(fieldItems) ? fieldItems.map(({ value }) => value) : fieldItems.value,
          }))
          return {
            ...item,
            value: _.defaults({}, item.value, ...fieldValues),
            context: item.context,
          }
        }),
      )
      const toServiceID = serviceIDKeyCreator({
        serviceIDFields: def.serviceIDFields ?? [],
        typeID: new ElemID(adapterName, typeName),
      })
      const groupedFragments = _.isEmpty(def.serviceIDFields)
        ? // fake grouping to avoid merging
          Object.fromEntries(allFragments.map((fragment, idx) => [idx, [fragment]]))
        : _.groupBy(allFragments, ({ value }) => toServiceID(value))
      const mergedFragments = _(groupedFragments)
        .mapValues(fragments => ({
          typeName,
          // concat arrays
          value: _.mergeWith({}, ...fragments.map(fragment => fragment.value), (first: unknown, second: unknown) =>
            Array.isArray(first) && Array.isArray(second) ? first.concat(second) : undefined,
          ),
          context: {
            fragments,
          },
        }))
        .mapValues(item =>
          collections.array.makeArray(
            createValueTransformer<{ fragments: GeneratedItem[] }, Values>(def.mergeAndTransform)(item),
          ),
        )
        .value()

      Object.values(mergedFragments)
        .flat()
        .forEach(item => items.push(item))
      done = true
      return {
        success: true,
      }
    } catch (e) {
      log.error('[%s] Error caught while fetching %s: %s. stack: %s', adapterName, typeName, e, (e as Error).stack)
      done = true
      if (_.isError(e)) {
        return {
          success: false,
          errors: [e],
        }
      }
      return {
        success: false,
        errors: [new Error(String(e))],
      }
    }
  }

  return {
    fetch,
    done: () => done,
    getItems,
  }
}
