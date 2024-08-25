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

const { APPLICATION_TYPE_NAME, APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME } = intuneConstants

const { recursiveNestedTypeName } = fetchUtils.element

export const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: {
      field: 'bundleId',
      parentTypes: [
        recursiveNestedTypeName(APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME, 'mobileAppIdentifier'),
      ],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'bundleId',
    // TODO SALTO-6527 partial coverage
    sourceTransformation: 'asCaseInsensitiveString',
  },
  {
    src: {
      field: 'packageId',
      parentTypes: [
        recursiveNestedTypeName(APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME, 'mobileAppIdentifier'),
      ],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'packageId',
    sourceTransformation: 'asCaseInsensitiveString',
  },
]
