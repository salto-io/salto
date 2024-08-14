/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { APIDefinitionsOptions, ResolveReferenceContextStrategiesType } from '../definitions'
import {
  ResolveReferenceSerializationStrategyLookup,
  ResolveReferenceIndexNames,
  ApiDefinitions,
} from '../definitions/system/api'
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
  definitions: Pick<ApiDefinitions<Options>, 'references'>,
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
