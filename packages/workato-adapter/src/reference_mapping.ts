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

import {
  Change,
  ChangeDataType,
  cloneDeepWithoutRefs,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc, GetLookupNameFuncArgs } from '@salto-io/adapter-utils'
import {
  fetch as fetchUtils,
  references as referenceUtils,
  resolveChangeElement,
  resolveValues,
} from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import {
  CONNECTION_TYPE,
  FOLDER_TYPE,
  NETSUITE,
  RECIPE_CODE_TYPE,
  RECIPE_CONFIG_TYPE,
  RECIPE_TYPE,
  SALESFORCE,
  WORKATO,
  ZENDESK,
} from './constants'
import { getFolderPath, getRootFolderID } from './utils'
import { resolveReference as salesforceResolver } from './filters/cross_service/salesforce/resolve'
import { resolveReference as netsuiteResolver } from './filters/cross_service/netsuite/resolve'
import { resolveReference as zendeskResolver } from './filters/cross_service/zendesk/resolve'
import { resolveWorkatoValues } from './rlm'

const { awu } = collections.asynciterable

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

export class WorkatoFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
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

export const deployResolveRules: WorkatoFieldReferenceDefinition[] = [
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
  return args.ref
}

const getCrossServiceLookupNameFunc =
  (
    resolveReferenceFunc: GetLookupNameFunc,
    accountToServiceNameMap: Record<string, string>,
    serviceName: string,
  ): GetLookupNameFunc =>
  async args => {
    if (accountToServiceNameMap[args.ref.elemID.adapter] === serviceName) {
      // TODO add check args.ref
      return resolveReferenceFunc(args)
    }
    return args.ref
  }

const getCrossServiceLookUpNameFuncs = (
  accountToServiceNameMap: Record<string, string> | undefined,
): GetLookupNameFunc[] =>
  accountToServiceNameMap
    ? [
        getCrossServiceLookupNameFunc(netsuiteResolver, accountToServiceNameMap, NETSUITE),
        getCrossServiceLookupNameFunc(salesforceResolver, accountToServiceNameMap, SALESFORCE),
        getCrossServiceLookupNameFunc(zendeskResolver, accountToServiceNameMap, ZENDESK),
      ]
    : []

const mergeLookUpNameFuncs = (lookUpNameFuncs: GetLookupNameFunc[]) => async (args: GetLookupNameFuncArgs) => {
  const resolveds = await awu(lookUpNameFuncs.map(lookupFunc => lookupFunc(args))).toArray()
  return resolveds.find(resolved => !isReferenceExpression(resolved)) ?? args.ref
}

export const workatoLookUpNameFunc = (
  accountToServiceNameMap: Record<string, string>,
  change: Change<ChangeDataType>,
): Promise<Change<ChangeDataType>> =>
  resolveChangeElement(
    change,
    mergeLookUpNameFuncs([...getCrossServiceLookUpNameFuncs(accountToServiceNameMap), localWorkatoLookUpName]),
    resolveWorkatoValues,
  )
