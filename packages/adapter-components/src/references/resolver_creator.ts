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
import { RequiredDefinitions } from '../definitions/system/types'
import { APIDefinitionsOptions, ResolveReferenceContextStrategiesType } from '../definitions'
import { ResolveReferenceSerializationStrategyLookup, ResolveReferenceIndexNames } from '../definitions/system/api'
import {
  FieldReferenceDefinition,
  FieldReferenceResolver,
  ReferenceSerializationStrategyName,
  ReferenceSerializationStrategy,
  ReferenceSerializationStrategyLookup,
} from './reference_mapping'

/**
 * create a reference resolver based on the definitions
 */
export const getResolverCreator = <Options extends APIDefinitionsOptions>(
  definitions: RequiredDefinitions<Options>,
): ((
  def: FieldReferenceDefinition<
    ResolveReferenceContextStrategiesType<Options>,
    ResolveReferenceSerializationStrategyLookup<Options>
  >,
) => FieldReferenceResolver<
  ResolveReferenceContextStrategiesType<Options>,
  ResolveReferenceSerializationStrategyLookup<Options>,
  ResolveReferenceIndexNames<Options>
>) => {
  if (definitions.references?.serializationStrategyLookup !== undefined) {
    const serializationStrategyLookup: Record<
      ReferenceSerializationStrategyName | ResolveReferenceSerializationStrategyLookup<Options>,
      ReferenceSerializationStrategy<ResolveReferenceIndexNames<Options>>
    > = _.merge({}, ReferenceSerializationStrategyLookup, definitions.references?.serializationStrategyLookup)
    return def =>
      FieldReferenceResolver.create<
        ResolveReferenceContextStrategiesType<Options>,
        ResolveReferenceSerializationStrategyLookup<Options>,
        ResolveReferenceIndexNames<Options>
      >(def, serializationStrategyLookup)
  }
  return def =>
    FieldReferenceResolver.create<
      ResolveReferenceContextStrategiesType<Options>,
      ResolveReferenceSerializationStrategyLookup<Options>,
      ResolveReferenceIndexNames<Options>
    >(def)
}
