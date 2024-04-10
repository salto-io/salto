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
import { FieldReferenceDefinition, addReferences, FieldReferenceResolver } from '../references'
import { APIDefinitionsOptions, ResolveReferenceContextStrategiesType } from '../definitions'
import { ResolveReferenceIndexNames, ResolveReferenceSerializationStrategyLookup } from '../definitions/system/api'

const { makeArray } = collections.array

export type FieldReferenceResolverCreator<Options extends APIDefinitionsOptions = {}> = (
  def: FieldReferenceDefinition<
    ResolveReferenceContextStrategiesType<Options>,
    ResolveReferenceSerializationStrategyLookup<Options>
  >,
) => FieldReferenceResolver<
  ResolveReferenceContextStrategiesType<Options>,
  ResolveReferenceSerializationStrategyLookup<Options>,
  ResolveReferenceIndexNames<Options>
>

/**
 * replace values with references based on a set of rules
 */
export const fieldReferencesFilterCreator =
  <TResult extends void | filter.FilterResult, Options extends APIDefinitionsOptions = {}>(
    referenceRules?: FieldReferenceDefinition<
      ResolveReferenceContextStrategiesType<Options>,
      ResolveReferenceSerializationStrategyLookup<Options>
    >[],
    fieldReferenceResolverCreator?: FieldReferenceResolverCreator<Options>,
  ): AdapterFilterCreator<{}, TResult, {}, Options> =>
  ({ definitions }) => ({
    name: 'fieldReferencesFilter',
    onFetch: async (elements: Element[]) => {
      await addReferences<
        ResolveReferenceContextStrategiesType<Options>,
        ResolveReferenceSerializationStrategyLookup<Options>,
        ResolveReferenceIndexNames<Options>,
        FieldReferenceDefinition<
          ResolveReferenceContextStrategiesType<Options>,
          ResolveReferenceSerializationStrategyLookup<Options>
        >
      >({
        elements,
        defs: makeArray(referenceRules).concat(makeArray(definitions.references?.rules)),
        contextStrategyLookup: definitions.references?.contextStrategyLookup,
        fieldsToGroupBy: definitions.references?.fieldsToGroupBy,
        fieldReferenceResolverCreator,
      })
    },
  })
