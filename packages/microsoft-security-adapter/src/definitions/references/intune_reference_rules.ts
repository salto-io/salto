/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, CustomReferenceSerializationStrategyName } from '../types'
import { intuneConstants } from '../../constants'

const {
  // Top level types
  APPLICATION_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
  APPLICATION_PROTECTION_ANDROID_TYPE_NAME,
  APPLICATION_PROTECTION_IOS_TYPE_NAME,
  APPLICATION_PROTECTION_WINDOWS_TYPE_NAME,
  APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME,
  DEVICE_COMPLIANCE_TYPE_NAME,
  DEVICE_CONFIGURATION_TYPE_NAME,
  DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
  FILTER_TYPE_NAME,
  PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  PLATFORM_SCRIPT_MAC_OS_TYPE_NAME,
  PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
  SCOPE_TAG_TYPE_NAME,
  TYPES_WITH_GROUP_ASSIGNMENTS_TARGET,
  // Nested types
  DEVICE_COMPLIANCE_RESTRICTED_APPS_TYPE_NAME,
  // OTHER
  TYPES_WITH_TARGET_APPS_MOBILE_APP_IDENTIFIER,
} = intuneConstants

export const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: {
      field: 'bundleId',
      parentTypes: TYPES_WITH_TARGET_APPS_MOBILE_APP_IDENTIFIER,
    },
    target: { type: APPLICATION_TYPE_NAME },
    serializationStrategy: 'bundleId',
    // TODO SALTO-6527 partial coverage
    sourceTransformation: 'asCaseInsensitiveString',
  },
  {
    src: {
      field: 'packageId',
      parentTypes: TYPES_WITH_TARGET_APPS_MOBILE_APP_IDENTIFIER,
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
  {
    src: { field: 'roleScopeTags', parentTypes: [FILTER_TYPE_NAME] },
    target: { type: SCOPE_TAG_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'roleScopeTagIds',
      parentTypes: [
        APPLICATION_TYPE_NAME,
        APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
        APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
        APPLICATION_PROTECTION_ANDROID_TYPE_NAME,
        APPLICATION_PROTECTION_IOS_TYPE_NAME,
        APPLICATION_PROTECTION_WINDOWS_TYPE_NAME,
        APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME,
        DEVICE_COMPLIANCE_TYPE_NAME,
        DEVICE_CONFIGURATION_TYPE_NAME,
        DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
        PLATFORM_SCRIPT_LINUX_TYPE_NAME,
        PLATFORM_SCRIPT_MAC_OS_TYPE_NAME,
        PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
      ],
    },
    target: { type: SCOPE_TAG_TYPE_NAME },
    serializationStrategy: 'id',
  },
]
