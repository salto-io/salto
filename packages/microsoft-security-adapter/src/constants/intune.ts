/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { fetch as fetchUtils } from '@salto-io/adapter-components'

const { recursiveNestedTypeName } = fetchUtils.element

const toIntuneTypeName = (typeName: string): string => `Intune${typeName}`

/* Field names */
// Shared fields
export const ASSIGNMENTS_FIELD_NAME = 'assignments'

// Application fields
export const PACKAGE_ID_FIELD_NAME = 'packageId'
export const BUNDLE_ID_FIELD_NAME = 'bundleId'
export const APP_IDENTIFIER_FIELD_NAME = 'appIdentifier'
export const APP_STORE_URL_FIELD_NAME = 'appStoreUrl'

// ApplicationConfigurationManagedApp fields
export const APPS_FIELD_NAME = 'apps'
export const ENCODED_SETTING_XML_FIELD_NAME = 'encodedSettingXml'
export const PAYLOAD_JSON_FIELD_NAME = 'payloadJson'

// DeviceConfigurationSettingCatalog fields
export const SETTINGS_FIELD_NAME = 'settings'
export const SETTING_COUNT_FIELD_NAME = 'settingCount'

// DeviceCompliance fields
export const RESTRICTED_APPS_FIELD_NAME = 'restrictedApps'
export const SCHEDULED_ACTIONS_FIELD_NAME = 'scheduledActionsForRule'
export const SCHEDULED_ACTION_CONFIGURATIONS_FIELD_NAME = 'scheduledActionConfigurations'

// Platform script fields
// Linux
export const SCRIPT_VALUE_FIELD_NAME = 'value'
export const SETTING_INSTANCE_FIELD_NAME = 'settingInstance'
export const SIMPLE_SETTING_VALUE_FIELD_NAME = 'simpleSettingValue'
export const SETTING_DEFINITION_ID_FIELD_NAME = 'settingDefinitionId'
// Windows
export const SCRIPT_CONTENT_FIELD_NAME = 'scriptContent'
export const SCRIPT_CONTENT_RECURSE_INTO_FIELD_NAME = 'scriptContentRecurseInto'

/* Type names */
// Top level
export const APPLICATION_TYPE_NAME = toIntuneTypeName('Application')
export const APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME = toIntuneTypeName('ApplicationConfigurationManagedApp')
export const APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME = toIntuneTypeName(
  'ApplicationConfigurationManagedDevice',
)
export const APPLICATION_PROTECTION_ANDROID_TYPE_NAME = toIntuneTypeName('ApplicationProtectionAndroid')
export const DEVICE_CONFIGURATION_TYPE_NAME = toIntuneTypeName('DeviceConfiguration')
export const DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME = toIntuneTypeName('DeviceConfigurationSettingCatalog')
export const DEVICE_COMPLIANCE_TYPE_NAME = toIntuneTypeName('DeviceCompliance')
export const FILTER_TYPE_NAME = toIntuneTypeName('Filter')
export const PLATFORM_SCRIPT_LINUX_TYPE_NAME = toIntuneTypeName('PlatformScriptLinux')
export const PLATFORM_SCRIPT_MAC_OS_TYPE_NAME = toIntuneTypeName('PlatformScriptMacOS')
export const PLATFORM_SCRIPT_WINDOWS_TYPE_NAME = toIntuneTypeName('PlatformScriptWindows')
export const SCOPE_TAG_TYPE_NAME = toIntuneTypeName('ScopeTag')

// Nested types
export const DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME = recursiveNestedTypeName(
  DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
  SETTINGS_FIELD_NAME,
)
export const DEVICE_COMPLIANCE_RESTRICTED_APPS_TYPE_NAME = recursiveNestedTypeName(
  DEVICE_COMPLIANCE_TYPE_NAME,
  RESTRICTED_APPS_FIELD_NAME,
)
export const DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME = recursiveNestedTypeName(
  DEVICE_COMPLIANCE_TYPE_NAME,
  SCHEDULED_ACTIONS_FIELD_NAME,
)
export const DEVICE_COMPLIANCE_SCHEDULED_ACTION_CONFIGURATIONS_TYPE_NAME = recursiveNestedTypeName(
  DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME,
  SCHEDULED_ACTION_CONFIGURATIONS_FIELD_NAME,
)
export const PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME = recursiveNestedTypeName(
  PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  SETTINGS_FIELD_NAME,
)
export const SCOPE_TAG_ASSIGNMENTS_TYPE_NAME = recursiveNestedTypeName(SCOPE_TAG_TYPE_NAME, ASSIGNMENTS_FIELD_NAME)

// Urls
export const SERVICE_BASE_URL = 'https://intune.microsoft.com'

// Group assignments
export const TYPES_WITH_GROUP_ASSIGNMENTS = [
  APPLICATION_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
  APPLICATION_PROTECTION_ANDROID_TYPE_NAME,
  DEVICE_CONFIGURATION_TYPE_NAME,
  DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
  DEVICE_COMPLIANCE_TYPE_NAME,
  PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  PLATFORM_SCRIPT_MAC_OS_TYPE_NAME,
  PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
  SCOPE_TAG_TYPE_NAME,
]
export const TYPES_WITH_GROUP_ASSIGNMENTS_ASSIGNMENTS = TYPES_WITH_GROUP_ASSIGNMENTS.map(typeName =>
  recursiveNestedTypeName(typeName, ASSIGNMENTS_FIELD_NAME),
)
export const TYPES_WITH_GROUP_ASSIGNMENTS_TARGET = TYPES_WITH_GROUP_ASSIGNMENTS.map(typeName =>
  recursiveNestedTypeName(typeName, ASSIGNMENTS_FIELD_NAME, 'target'),
)
export const ASSIGNMENTS_ODATA_CONTEXT = 'assignments@odata.context'

// Target apps
const TYPES_WITH_TARGET_APPS = [
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPLICATION_PROTECTION_ANDROID_TYPE_NAME,
]
export const TYPES_WITH_TARGET_APPS_APPS = TYPES_WITH_TARGET_APPS.map(typeName =>
  recursiveNestedTypeName(typeName, APPS_FIELD_NAME),
)
export const TYPES_WITH_TARGET_APPS_MOBILE_APP_IDENTIFIER = TYPES_WITH_TARGET_APPS_APPS.map(typeName =>
  recursiveNestedTypeName(typeName, 'mobileAppIdentifier'),
)
