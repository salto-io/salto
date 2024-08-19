/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { references as referenceUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, CustomReferenceSerializationStrategyName } from '../types'
import { intuneConstants } from '../../constants'

const { APPLICATION_TYPE_NAME, APPLICATION_CONFIGURATION_MANAGED_APP_APPS } = intuneConstants

const { recursiveNestedTypeName } = fetchUtils.element

export const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  // According to the openapi (beta) doc, the possible values for the mobileAppIdentifier field are: bundleId, packageId and windowsAppId.
  // However, in practice, only bundleId and packageId are used, and the windowsAppId is not referenced in the doc, and does not appear in V1 /the UI.
  {
    src: {
      field: 'bundleId',
      parentTypes: [recursiveNestedTypeName(APPLICATION_CONFIGURATION_MANAGED_APP_APPS, 'mobileAppIdentifier')],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'bundleId',
    // TODO SALTO-6527: This definition doesn't actually work here because it only transforms the source value to lowercase,
    // but the target value can have any casing, which may cause missed references.
    sourceTransformation: 'asCaseInsensitiveString',
  },
  {
    src: {
      field: 'packageId',
      parentTypes: [recursiveNestedTypeName(APPLICATION_CONFIGURATION_MANAGED_APP_APPS, 'mobileAppIdentifier')],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'packageId',
    sourceTransformation: 'asCaseInsensitiveString',
  },
]
