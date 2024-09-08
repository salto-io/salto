/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, references as referenceUtils, createChangeElementResolver } from '@salto-io/adapter-components'
import { Change, InstanceElement } from '@salto-io/adapter-api'
import { ODATA_TYPE_FIELD_NACL_CASE, entraConstants } from '../../constants'
import { CustomReferenceSerializationStrategyName, Options } from '../types'
import { REFERENCE_RULES as EntraReferenceRules } from './entra_reference_rules'
import { REFERENCE_RULES as IntuneReferenceRules } from './intune_reference_rules'
import { REFERENCE_RULES as CrossReferenceRules } from './cross_reference_rules'

const REFERENCE_RULES = [...EntraReferenceRules, ...IntuneReferenceRules, ...CrossReferenceRules]

// We only use this record as a TS 'hack' to fail the build if we add a custom serialization strategy
// and forget to add it to the fieldsToGroupBy.
const fieldsToGroupBy: Record<referenceUtils.ReferenceIndexField | CustomReferenceSerializationStrategyName, null> = {
  id: null,
  name: null,
  appId: null,
  bundleId: null,
  packageId: null,
}

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  fieldsToGroupBy: Object.keys(fieldsToGroupBy) as Array<keyof typeof fieldsToGroupBy>,
  serializationStrategyLookup: {
    // Entra serialization strategies lookup
    appId: {
      serialize: ({ ref }) => ref.value.value.appId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'appId',
    },
    // Intune serialization strategies lookup
    bundleId: {
      serialize: ({ ref }) => ref.value.value.bundleId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'bundleId',
    },
    packageId: {
      serialize: ({ ref }) => ref.value.value.packageId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'packageId',
    },
  },
  contextStrategyLookup: {
    ODataType: referenceUtils.neighborContextGetter({
      contextFieldName: ODATA_TYPE_FIELD_NACL_CASE,
      getLookUpName: async ({ ref }) => ref.elemID.name,
      contextValueMapper: refType => entraConstants.SUPPORTED_DIRECTORY_OBJECTS_ODATA_TYPE_NAME_TO_TYPE_NAME[refType],
    }),
  },
}

const resolverCreator = referenceUtils.getResolverCreator<Options>({ references: REFERENCES })
export const changeResolver = createChangeElementResolver<Change<InstanceElement>>({
  getLookUpName: referenceUtils.generateLookupFunc(REFERENCE_RULES, resolverCreator),
})
