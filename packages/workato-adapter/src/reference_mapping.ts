/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { cloneDeepWithoutRefs, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { GetLookupNameFunc, GetLookupNameFuncArgs, resolveValues } from '@salto-io/adapter-utils'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { CONNECTION_TYPE, FOLDER_TYPE, NETSUITE, RECIPE_CODE_TYPE, RECIPE_CONFIG_TYPE, RECIPE_TYPE, SALESFORCE, WORKATO, ZENDESK } from './constants'
import { resolveReference as salesforceResolver } from './filters/cross_service/salesforce/resolve'
import { resolveReference as netsuiteResolver } from './filters/cross_service/netsuite/resolve'
import { resolveReference as zendeskResolver } from './filters/cross_service/zendesk/resolve'
import { getFolderPath, getRootFolderID } from './utils'
import { fieldNameToTypeMappingDefs } from './filters/field_references'

const { awu } = collections.asynciterable

type WorkatoReferenceSerializationStrategyName = 'serializeInner' | 'folderPath'
type WorkatoFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<never> & {
  WorkatoSerializationStrategy?: WorkatoReferenceSerializationStrategyName
}

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
    lookupIndexName: 'serializeInner',
  },
  folderPath: {
    serialize: async ({ ref }) => ({
      folderParts: getFolderPath(ref.value),
      rootId: getRootFolderID(ref.value),
    }),
    lookup: referenceUtils.basicLookUp,
    lookupIndexName: 'folderPath',
  },
}

export class WorkatoFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
WorkatoReferenceSerializationStrategyName
> {
  constructor(def: WorkatoFieldReferenceDefinition) {
    super({ src: def.src, sourceTransformation: def.sourceTransformation ?? 'asString' })
    this.serializationStrategy = WorkatoReferenceSerializationStrategyLookup[
      def.WorkatoSerializationStrategy ?? def.serializationStrategy ?? 'fullValue'
    ]
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }
}


export const referencesRules: WorkatoFieldReferenceDefinition[] = [
  {
    src: { field: 'account_id', parentTypes: [RECIPE_CONFIG_TYPE] },
    WorkatoSerializationStrategy: 'serializeInner',
    target: { type: CONNECTION_TYPE },
  },
  {
    src: { field: 'folder_id', parentTypes: [RECIPE_CONFIG_TYPE, CONNECTION_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE] },
    WorkatoSerializationStrategy: 'folderPath',
    target: { type: FOLDER_TYPE },
  },
  ...fieldNameToTypeMappingDefs,
]

// The second param is needed to resolve references by WorkatoSerializationStrategy
localWorkatoLookUpName = async args => {
  if (args.ref.elemID.adapter === WORKATO) {
    return referenceUtils.generateLookupFunc(
      referencesRules, defs => new WorkatoFieldReferenceResolver(defs)
    )(args)
  }
  return args.ref
}
export const workatoLookUpName = localWorkatoLookUpName

const getCrossServiceLookupNameFunc = (
  resolveReferenceFunc: GetLookupNameFunc,
  accountToServiceNameMap: Record<string, string>,
  serviceName: string
): GetLookupNameFunc => async args => {
  if (accountToServiceNameMap[args.ref.elemID.adapter] === serviceName) { // TODO add check args.ref
    return resolveReferenceFunc(args)
  }
  return args.ref
}

export const getCrossServiceLookUpNameFuncs = (
  accountToServiceNameMap: Record<string, string> | undefined
): GetLookupNameFunc[] => (accountToServiceNameMap ? [
  getCrossServiceLookupNameFunc(netsuiteResolver, accountToServiceNameMap, NETSUITE),
  getCrossServiceLookupNameFunc(salesforceResolver, accountToServiceNameMap, SALESFORCE),
  getCrossServiceLookupNameFunc(zendeskResolver, accountToServiceNameMap, ZENDESK),
] : [])

export const mergeLookUpNameFuncs = (
  lookUpNameFuncs: GetLookupNameFunc[]
) => (async (args: GetLookupNameFuncArgs) => {
  const resolveds = await awu(lookUpNameFuncs.map(
    lookupFunc => lookupFunc(args)
  )).toArray()
  return resolveds.find(resolved => !isReferenceExpression(resolved)) ?? args.ref
})
