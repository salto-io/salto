/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
export { neighborContextGetter, ContextFunc, ContextValueMapperFunc, findParentPath } from './context'
export { addReferences, replaceReferenceValues, generateLookupFunc } from './field_references'
export {
  createMissingInstance,
  createMissingValueReference,
  checkMissingRef,
  MISSING_REF_PREFIX,
} from './missing_references'
export {
  ReferenceSerializationStrategy,
  ReferenceSerializationStrategyName,
  ReferenceSerializationStrategyLookup,
  ReferenceSourceTransformationLookup,
  ReferenceSourceTransformationName,
  ReferenceSourceTransformation,
  MissingReferenceStrategy,
  MissingReferenceStrategyName,
  FieldReferenceDefinition,
  FieldReferenceSourceDefinition,
  FieldReferenceResolver,
  ReferenceResolverFinder,
  ReferenceTargetDefinition,
  ExtendedReferenceTargetDefinition,
  LookupFunc,
  basicLookUp,
  ReferenceIndexField,
} from './reference_mapping'
export { getResolverCreator } from './resolver_creator'
