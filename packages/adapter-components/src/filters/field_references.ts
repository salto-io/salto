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
import { Element } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { AdapterFilterCreator } from '../filter_utils'
import { FieldReferenceDefinition, addReferences } from '../references'

const { makeArray } = collections.array

/**
 * replace values with references based on a set of rules
 */
export const fieldReferencesFilterCreator =
  <
    TResult extends void | filter.FilterResult,
    ClientOptions extends string,
    PaginationOptions extends string | 'none',
    AdditionalAction extends string,
  >(
    referenceRules?: FieldReferenceDefinition<never>[],
  ): AdapterFilterCreator<{}, TResult, {}, ClientOptions, PaginationOptions, AdditionalAction> =>
  ({ definitions }) => ({
    name: 'fieldReferencesFilter',
    onFetch: async (elements: Element[]) => {
      await addReferences({
        elements,
        defs: makeArray(referenceRules).concat(makeArray(definitions.references?.rules)),
      })
    },
  })
