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
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FetchResourceDefinition } from '../../definitions/system/fetch/resource'
import { TypeFetcherCreator, ValueGeneratedItem } from '../types'
import { createValueTransformer } from '../utils'
import { RecurseIntoDefinition } from '../../definitions/system/fetch/dependencies'
import { ElementGenerator } from '../element/element'

const log = logger(module)

type NestedResourceFetcher = (
  item: ValueGeneratedItem,
) => Promise<Record<string, ValueGeneratedItem[] | ValueGeneratedItem>>

const extractRecurseIntoContext = (
  item: ValueGeneratedItem,
  recurseIntoDef: RecurseIntoDefinition,
): Record<string, unknown> => {
  const { args: contextArgs } = recurseIntoDef.context
  const context = _.mapValues(contextArgs, contextDef => {
    const transformer = createValueTransformer(contextDef)
    const transformedItem = transformer(item)
    if (Array.isArray(transformedItem)) {
      return transformedItem.map(({ value }) => value)
    }
    return transformedItem?.value
  })
  return context
}

export type RecurseIntoConditionBase = { match: string[] }
type RecurseIntoConditionByField = RecurseIntoConditionBase & {
  fromField: string
}
type RecurseIntoConditionByContext = RecurseIntoConditionBase & {
  fromContext: string
}
export type RecurseIntoCondition = RecurseIntoConditionByField | RecurseIntoConditionByContext

export const isRecurseIntoConditionByField = (
  condition: RecurseIntoCondition,
): condition is RecurseIntoConditionByField => 'fromField' in condition

export const shouldRecurseIntoEntry = (
  entry: Values,
  context?: Record<string, unknown>,
  conditions?: RecurseIntoCondition[],
): boolean =>
  (conditions ?? []).every(condition => {
    const compareValue = isRecurseIntoConditionByField(condition)
      ? _.get(entry, condition.fromField)
      : _.get(context, condition.fromContext)
    return condition.match.some(m => new RegExp(m).test(compareValue))
  })

// TODO remove the old code when possible - originally called getExtraFieldValues
export const recurseIntoSubresources =
  ({
    def,
    typeFetcherCreator,
    handleError,
    contextResources,
  }: {
    def: FetchResourceDefinition
    typeFetcherCreator: TypeFetcherCreator
    handleError: ElementGenerator['handleError']
    contextResources: Record<string, ValueGeneratedItem[] | undefined>
  }): NestedResourceFetcher =>
  async item =>
    Object.fromEntries(
      (
        await Promise.all(
          Object.entries(def.recurseInto ?? {})
            .filter(([_fieldName, { conditions }]) => shouldRecurseIntoEntry(item.value, item.context, conditions))
            .map(async ([fieldName, recurseDef]) => {
              const nestedRequestContext = extractRecurseIntoContext(item, recurseDef)
              const typeFetcher = typeFetcherCreator({
                typeName: recurseDef.typeName,
                context: { ...item.context, ...nestedRequestContext },
              })
              if (typeFetcher === undefined) {
                log.debug('no resource fetcher defined for type %s, cannot recurse into resource', recurseDef.typeName)
                return []
              }
              const recurseRes = await typeFetcher.fetch({ contextResources, typeFetcherCreator })
              if (!recurseRes.success) {
                handleError({ typeName: recurseDef.typeName, error: recurseRes.error })
                return []
              }
              const items = typeFetcher.getItems()
              if (recurseDef.single) {
                if (items?.length === 1) {
                  return [fieldName, items[0]]
                }
                log.warn(
                  `Expected a single value in recurseInto result for ${recurseDef.typeName}.${fieldName} but received: ${items?.length ?? 0}, keeping as list`,
                )
              }
              return [fieldName, items]
            }),
        )
      ).filter(([_fieldName, nestedEntries]) => !_.isEmpty(nestedEntries)),
    )
