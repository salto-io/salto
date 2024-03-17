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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { addAliasToElements, AliasData } from '../add_alias'
import { ApiDefinitions, APIDefinitionsOptions, queryWithDefault } from '../definitions'
import { FilterCreator } from '../filter_utils'

/**
 * Add aliases to instances according to definitions.
 */
export const addAliasFilterCreator: <
  TClient,
  TContext,
  TResult extends void | filter.FilterResult,
  Options extends APIDefinitionsOptions = {},
>(
  definitions: ApiDefinitions<Options>,
) => FilterCreator<TClient, TContext, TResult> = definitions => () => ({
  name: 'addAliasFilter',
  onFetch: async (elements: Element[]) => {
    if (definitions.fetch !== undefined) {
      const { instances } = definitions.fetch
      const defQuery = queryWithDefault(instances)
      const elementsMap = _.groupBy(elements.filter(isInstanceElement), e => e.elemID.typeName)
      const allDefs = defQuery.getAll()
      const aliasMap = Object.entries(allDefs).reduce<Record<string, AliasData>>((currentRecord, [typeName, def]) => {
        const aliasData = def.element?.topLevel?.alias
        if (aliasData === undefined) {
          return currentRecord
        }
        return {
          ...currentRecord,
          [typeName]: aliasData,
        }
      }, {})
      addAliasToElements({ elementsMap, aliasMap })
    }
  },
})
