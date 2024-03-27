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
import { logger } from '@salto-io/logging'
import { FetchResourceDefinition } from '../../definitions/system/fetch/resource'
import { TypeFetcherCreator, ValueGeneratedItem } from '../types'
import { shouldRecurseIntoEntry } from '../../elements/instance_elements' // TODO move

const log = logger(module)

type NestedResourceFetcher = (
  item: ValueGeneratedItem,
) => Promise<Record<string, ValueGeneratedItem[] | ValueGeneratedItem>>

// TODO remove the old code when possible - originally called getExtraFieldValues
export const recurseIntoSubresources =
  ({
    def,
    typeFetcherCreator,
    contextResources,
  }: {
    def: FetchResourceDefinition
    typeFetcherCreator: TypeFetcherCreator
    contextResources: Record<string, ValueGeneratedItem[] | undefined>
  }): NestedResourceFetcher =>
  async item =>
    Object.fromEntries(
      (
        await Promise.all(
          Object.entries(def.recurseInto ?? {})
            .filter(([_fieldName, { conditions }]) => shouldRecurseIntoEntry(item.value, item.context, conditions))
            .map(async ([fieldName, recurseDef]) => {
              const nestedRequestContext = _.mapValues(recurseDef.context.args, contextDef =>
                _.get(item.value, contextDef.fromField),
              )
              // TODO avoid crashing if fails on sub-element (SALTO-5427)
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
                // TODO throw (SALTO-5427)
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
