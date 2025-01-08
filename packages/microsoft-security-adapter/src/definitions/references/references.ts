/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { definitions, references as referenceUtils, createChangeElementResolver } from '@salto-io/adapter-components'
import { Change, InstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { ODATA_TYPE_FIELD_NACL_CASE, entraConstants } from '../../constants'
import { CustomReferenceSerializationStrategyName, Options } from '../types'
import { REFERENCE_RULES as EntraReferenceRules } from './entra_reference_rules'
import { REFERENCE_RULES as IntuneReferenceRules } from './intune_reference_rules'
import { REFERENCE_RULES as CrossReferenceRules } from './cross_reference_rules'

const log = logger(module)

const REFERENCE_RULES = [...EntraReferenceRules, ...IntuneReferenceRules, ...CrossReferenceRules]

type FieldsToGroupBy =
  | referenceUtils.ReferenceIndexField
  | Exclude<CustomReferenceSerializationStrategyName, 'servicePrincipalAppId'>

// We only use this record as a TS 'hack' to fail the build if we add a custom serialization strategy
// and forget to add it to the fieldsToGroupBy.
const fieldsToGroupBy: Record<FieldsToGroupBy, null> = {
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
    servicePrincipalAppId: {
      serialize: ({ ref }) => {
        const { appId } = ref.value.value
        if (isReferenceExpression(appId)) {
          if (appId.elemID.typeName !== entraConstants.APPLICATION_TYPE_NAME) {
            log.error('Unexpected reference type %s for appId', appId.elemID.typeName)
          }
          return appId.value.value.appId
        }
        return appId
      },
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
      contextValueMapper: odataFieldValue =>
        entraConstants.SUPPORTED_DIRECTORY_OBJECTS_ODATA_TYPE_NAME_TO_TYPE_NAME[odataFieldValue],
    }),
    resourceAccessType: referenceUtils.neighborContextGetter({
      contextFieldName: 'type',
      getLookUpName: async ({ ref }) => ref.elemID.name,
      // TODO SALTO-6933: Cover 'Scope' type
      contextValueMapper: typeFieldValue => (typeFieldValue === 'Role' ? entraConstants.APP_ROLE_TYPE_NAME : undefined),
    }),
  },
}

const resolverCreator = referenceUtils.getResolverCreator<Options>({ references: REFERENCES })
export const changeResolver = createChangeElementResolver<Change<InstanceElement>>({
  getLookUpName: referenceUtils.generateLookupFunc(REFERENCE_RULES, resolverCreator),
})
