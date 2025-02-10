/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import objectHash from 'object-hash'
import { ElemID, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, promises, values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementQuery } from '../query'
import { Requester } from '../request/requester'
import { TypeResourceFetcher, ValueGeneratedItem } from '../types'
import { DefQuery } from '../../definitions/system'
import { GeneratedItem } from '../../definitions/system/shared'
import { FetchResourceDefinition } from '../../definitions/system/fetch/resource'
import { recurseIntoSubresources } from './subresources'
import { createValueTransformer } from '../utils'
import { DependsOnDefinition } from '../../definitions/system/fetch/dependencies'
import { serviceIDKeyCreator } from '../element/id_utils'
import { ElementGenerator } from '../element/element'

const { mapValuesAsync } = promises.object
const log = logger(module)

const calculateContextArgs = async ({
  contextDef,
  initialRequestContext,
  contextResources,
}: {
  contextDef?: FetchResourceDefinition['context']
  initialRequestContext?: Record<string, unknown>
  contextResources: Record<string, ValueGeneratedItem[] | undefined>
}): Promise<Record<string, unknown[]>> => {
  const { dependsOn } = contextDef ?? {}
  const predefinedArgs = _.mapValues(initialRequestContext, collections.array.makeArray)
  const remainingDependsOnArgs: Record<string, DependsOnDefinition> = _.omit(dependsOn, Object.keys(predefinedArgs))
  const dependsOnArgs = _(
    await mapValuesAsync(remainingDependsOnArgs, async arg =>
      _.flatten(
        await Promise.all(
          (contextResources[arg.parentTypeName] ?? []).map(async item =>
            createValueTransformer<{}, Values>(arg.transformation)({
              typeName: arg.parentTypeName,
              value: { ...item.value, ...item.context },
              context: item.context,
            }),
          ),
        ),
      ).filter(lowerdashValues.isDefined),
    ),
  )
    .pickBy(lowerdashValues.isDefined)
    .mapValues(values => _.uniqBy(values, objectHash))
    .value()

  return _.defaults(
    {},
    predefinedArgs,
    _.mapValues(dependsOnArgs, array => _.map(array, 'value')),
  )
}

export const createTypeResourceFetcher = <ClientOptions extends string>({
  adapterName,
  typeName,
  resourceDefQuery,
  query,
  requester,
  initialRequestContext,
  handleError,
  customItemFilter,
}: {
  adapterName: string
  typeName: string
  resourceDefQuery: DefQuery<FetchResourceDefinition>
  query: ElementQuery
  requester: Requester<ClientOptions>
  handleError: ElementGenerator['handleError']
  initialRequestContext?: Record<string, unknown>
  customItemFilter?: (item: ValueGeneratedItem) => boolean
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

    const contextPossibleArgs = await calculateContextArgs({
      contextDef: def.context,
      initialRequestContext,
      contextResources,
    })
    try {
      const itemsWithContext = await requester.requestAllForResource({
        callerIdentifier: { typeName },
        contextPossibleArgs,
      })

      const recurseIntoFetcher = recurseIntoSubresources({
        def,
        typeFetcherCreator,
        handleError,
        contextResources,
      })

      const maybeFilterItemWithCustomFilter =
        customItemFilter === undefined ? () => true : (item: ValueGeneratedItem) => customItemFilter(item)

      const allFragments = await Promise.all(
        itemsWithContext.filter(maybeFilterItemWithCustomFilter).map(async item => {
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
      const mergedFragments = await mapValuesAsync(
        _.mapValues(groupedFragments, fragments => ({
          typeName,
          // concat arrays
          value: _.mergeWith({}, ...fragments.map(fragment => fragment.value), (first: unknown, second: unknown) =>
            Array.isArray(first) && Array.isArray(second) ? first.concat(second) : undefined,
          ),
          context: {
            fragments,
          },
        })),
        async item =>
          collections.array.makeArray(
            await createValueTransformer<{ fragments: GeneratedItem[] }, Values>(def.mergeAndTransform)(item),
          ),
      )

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
      return {
        success: false,
        error: _.isError(e) ? e : new Error(String(e)),
      }
    }
  }

  return {
    fetch,
    done: () => done,
    getItems,
  }
}
