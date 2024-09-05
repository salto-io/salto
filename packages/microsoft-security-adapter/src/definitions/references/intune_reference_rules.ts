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

const {
  APPLICATION_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
  DEVICE_COMPLIANCE_RESTRICTED_APPS_TYPE_NAME,
  FILTER_TYPE_NAME,
  TYPES_WITH_GROUP_ASSIGNMENTS_TARGET,
} = intuneConstants

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
  {
    src: {
      field: 'targetedMobileApps',
      parentTypes: [APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'appId',
      parentTypes: [DEVICE_COMPLIANCE_RESTRICTED_APPS_TYPE_NAME],
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'bundleId',
  },
  {
    src: {
      field: 'deviceAndAppManagementAssignmentFilterId',
      parentTypes: TYPES_WITH_GROUP_ASSIGNMENTS_TARGET,
    },
    target: { type: FILTER_TYPE_NAME },
    serializationStrategy: 'id',
  },
]
