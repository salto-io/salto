/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { cloneDeepWithoutRefs, isInstanceElement } from '@salto-io/adapter-api'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { fetch as fetchUtils, references as referenceUtils, resolveValues } from '@salto-io/adapter-components'
import { CONNECTION_TYPE, FOLDER_TYPE, RECIPE_CODE_TYPE, RECIPE_CONFIG_TYPE, RECIPE_TYPE, WORKATO } from './constants'
import { getFolderPath, getRootFolderID } from './utils'

type WorkatoReferenceSerializationStrategyName = 'serializeInner' | 'folderPath'
type WorkatoFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<
  never,
  WorkatoReferenceSerializationStrategyName
>

const { toNestedTypeName } = fetchUtils.element

let localWorkatoLookUpName: GetLookupNameFunc

const WorkatoReferenceSerializationStrategyLookup: Record<
  WorkatoReferenceSerializationStrategyName | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy
> = {
  ...referenceUtils.ReferenceSerializationStrategyLookup,
  serializeInner: {
    serialize: async ({ ref }) => {
      const inner = await resolveValues(cloneDeepWithoutRefs(ref.value), localWorkatoLookUpName)
      return isInstanceElement(inner.value) ? inner.value.value : inner.value
    },
    lookup: referenceUtils.basicLookUp,
  },
  folderPath: {
    serialize: async ({ ref }) => ({
      folderParts: getFolderPath(ref.value),
      rootId: getRootFolderID(ref.value),
    }),
    lookup: referenceUtils.basicLookUp,
  },
}

class WorkatoFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
  never,
  WorkatoReferenceSerializationStrategyName
> {
  constructor(def: WorkatoFieldReferenceDefinition) {
    super(
      { ...def, sourceTransformation: def.sourceTransformation ?? 'asString' },
      WorkatoReferenceSerializationStrategyLookup,
    )
  }
}

export const fieldNameToTypeMappingDefs: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'api_client_id', parentTypes: ['api_access_profile'] },
    serializationStrategy: 'id',
    target: { type: 'api_client' },
  },
  {
    src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
    serializationStrategy: 'id',
    target: { type: 'api_collection' },
  },
  {
    src: { field: 'api_collection_id', parentTypes: ['api_endpoint'] },
    serializationStrategy: 'id',
    target: { type: 'api_collection' },
  },
  {
    src: { field: 'flow_id', parentTypes: ['api_endpoint'] },
    serializationStrategy: 'id',
    target: { type: 'recipe' },
  },
  {
    src: { field: 'parent_id', parentTypes: ['folder'] },
    serializationStrategy: 'id',
    target: { type: 'folder' },
  },
  {
    src: { field: 'account_id', parentTypes: [toNestedTypeName('recipe', 'config')] },
    serializationStrategy: 'id',
    target: { type: 'connection' },
  },
  {
    src: { field: 'folder_id', parentTypes: ['recipe', 'connection'] },
    serializationStrategy: 'id',
    target: { type: 'folder' },
  },
]

const deployResolveRules: WorkatoFieldReferenceDefinition[] = [
  // This rule is needed while deploying the recipe using rlm
  // While importing zip by rlm we need to get all resolved data from the connection to the recipe config
  {
    src: { field: 'account_id', parentTypes: [RECIPE_CONFIG_TYPE] },
    serializationStrategy: 'serializeInner',
    target: { type: CONNECTION_TYPE },
  },
  // This rule is needed while deploying using rlm
  // Importing zip by rlm should get the root folder path
  {
    src: { field: 'folder_id', parentTypes: [RECIPE_CONFIG_TYPE, CONNECTION_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE] },
    serializationStrategy: 'folderPath',
    target: { type: FOLDER_TYPE },
  },
  ...fieldNameToTypeMappingDefs,
]

localWorkatoLookUpName = async args => {
  if (args.ref.elemID.adapter === WORKATO) {
    // The second param is needed to resolve references by WorkatoSerializationStrategy
    return referenceUtils.generateLookupFunc(deployResolveRules, defs => new WorkatoFieldReferenceResolver(defs))(args)
  }
  // TODO - support cross-service references on deploy - SALTO-5997
  throw new Error('We Currently not support cross-service references in deploy')
}
export const workatoLookUpName = localWorkatoLookUpName
