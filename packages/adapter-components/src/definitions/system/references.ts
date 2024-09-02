/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { types } from '@salto-io/lowerdash'
import { ContextFunc, FieldReferenceDefinition, ReferenceSerializationStrategy } from '../../references'
import { ReferenceIndexField } from '../../references/reference_mapping'

export type ReferenceDefinitions<
  ContextStrategy extends string = never,
  SerializationStrategyName extends string = never,
  CustomIndexField extends string = never,
> = types.PickyRequired<
  {
    // rules for finding references - converting values to references in fetch, and references to values in deploy.
    // this is an array of arrays because rules can be run in multiple iterations during fetch
    rules: FieldReferenceDefinition<ContextStrategy, SerializationStrategyName>[]
    // custom context startegies for computing the value to lookup
    contextStrategyLookup?: Record<ContextStrategy, ContextFunc>
    // custom serialization strategies for how to lookup-and-serialize a calculated value
    serializationStrategyLookup?: Record<SerializationStrategyName, ReferenceSerializationStrategy<CustomIndexField>>
    // fields to use to index instances for lookup.
    // by default we index by id and name - if fieldsToGroupBy is defined, they should be listed as well
    // or they will not be indexed
    fieldsToGroupBy?: (ReferenceIndexField | CustomIndexField)[]
  },
  | (ContextStrategy extends never ? never : 'contextStrategyLookup')
  | (SerializationStrategyName extends never ? never : 'serializationStrategyLookup')
  | (CustomIndexField extends never ? never : 'fieldsToGroupBy')
>
