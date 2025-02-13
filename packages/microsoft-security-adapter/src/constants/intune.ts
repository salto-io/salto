/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { fetch as fetchUtils } from '@salto-io/adapter-components'
import { EndpointPath } from '../definitions/types'

const { recursiveNestedTypeName } = fetchUtils.element

type IntuneTypeName = `Intune${string}`

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
const RESTRICTED_APPS_FIELD_NAME = 'restrictedApps'
export const SCHEDULED_ACTIONS_FIELD_NAME = 'scheduledActionsForRule'
const SCHEDULED_ACTION_CONFIGURATIONS_FIELD_NAME = 'scheduledActionConfigurations'

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
export const TOP_LEVEL_TYPES = {
  APPLICATION_TYPE_NAME: 'IntuneApplication',
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME: 'IntuneApplicationConfigurationManagedApp',
  APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME: 'IntuneApplicationConfigurationManagedDevice',
  APPLICATION_PROTECTION_ANDROID_TYPE_NAME: 'IntuneApplicationProtectionAndroid',
  APPLICATION_PROTECTION_IOS_TYPE_NAME: 'IntuneApplicationProtectionIOS',
  APPLICATION_PROTECTION_WINDOWS_TYPE_NAME: 'IntuneApplicationProtectionWindows',
  APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME:
    'IntuneApplicationProtectionWindowsInformationProtection',
  DEVICE_CONFIGURATION_TYPE_NAME: 'IntuneDeviceConfiguration',
  DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME: 'IntuneDeviceConfigurationSettingCatalog',
  DEVICE_COMPLIANCE_TYPE_NAME: 'IntuneDeviceCompliance',
  FILTER_TYPE_NAME: 'IntuneFilter',
  PLATFORM_SCRIPT_LINUX_TYPE_NAME: 'IntunePlatformScriptLinux',
  PLATFORM_SCRIPT_MAC_OS_TYPE_NAME: 'IntunePlatformScriptMacOS',
  PLATFORM_SCRIPT_WINDOWS_TYPE_NAME: 'IntunePlatformScriptWindows',
  SCOPE_TAG_TYPE_NAME: 'IntuneScopeTag',
} as const

// This anonymous function is only used for compile time validation.
// Once we upgrade to TS 4.9 or newer we can use the new `satisfies` syntax instead.
;(<T extends Record<string, IntuneTypeName>>(_value: T): void => {})(TOP_LEVEL_TYPES)

// Nested types
export const DEVICE_CONFIGURATION_SETTING_CATALOG_SETTINGS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
  SETTINGS_FIELD_NAME,
)
export const DEVICE_COMPLIANCE_RESTRICTED_APPS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.DEVICE_COMPLIANCE_TYPE_NAME,
  RESTRICTED_APPS_FIELD_NAME,
)
export const DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.DEVICE_COMPLIANCE_TYPE_NAME,
  SCHEDULED_ACTIONS_FIELD_NAME,
)
export const DEVICE_COMPLIANCE_SCHEDULED_ACTION_CONFIGURATIONS_TYPE_NAME = recursiveNestedTypeName(
  DEVICE_COMPLIANCE_SCHEDULED_ACTIONS_TYPE_NAME,
  SCHEDULED_ACTION_CONFIGURATIONS_FIELD_NAME,
)
export const PLATFORM_SCRIPT_LINUX_SETTINGS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  SETTINGS_FIELD_NAME,
)
export const SCOPE_TAG_ASSIGNMENTS_TYPE_NAME = recursiveNestedTypeName(
  TOP_LEVEL_TYPES.SCOPE_TAG_TYPE_NAME,
  ASSIGNMENTS_FIELD_NAME,
)

// Urls
export const SERVICE_BASE_URL = 'https://intune.microsoft.com'

// Assignments
export const TYPES_WITH_ASSIGNMENTS = [
  TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME,
  TOP_LEVEL_TYPES.APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  TOP_LEVEL_TYPES.APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME,
  TOP_LEVEL_TYPES.APPLICATION_PROTECTION_ANDROID_TYPE_NAME,
  TOP_LEVEL_TYPES.APPLICATION_PROTECTION_IOS_TYPE_NAME,
  TOP_LEVEL_TYPES.APPLICATION_PROTECTION_WINDOWS_TYPE_NAME,
  TOP_LEVEL_TYPES.APPLICATION_PROTECTION_WINDOWS_INFORMATION_PROTECTION_TYPE_NAME,
  TOP_LEVEL_TYPES.DEVICE_CONFIGURATION_TYPE_NAME,
  TOP_LEVEL_TYPES.DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME,
  TOP_LEVEL_TYPES.DEVICE_COMPLIANCE_TYPE_NAME,
  TOP_LEVEL_TYPES.PLATFORM_SCRIPT_LINUX_TYPE_NAME,
  TOP_LEVEL_TYPES.PLATFORM_SCRIPT_MAC_OS_TYPE_NAME,
  TOP_LEVEL_TYPES.PLATFORM_SCRIPT_WINDOWS_TYPE_NAME,
  TOP_LEVEL_TYPES.SCOPE_TAG_TYPE_NAME,
] as const

export const TYPES_WITH_ASSIGNMENTS_ASSIGNMENTS = TYPES_WITH_ASSIGNMENTS.map(typeName =>
  recursiveNestedTypeName(typeName, ASSIGNMENTS_FIELD_NAME),
)
export const TYPES_WITH_ASSIGNMENTS_TARGET = TYPES_WITH_ASSIGNMENTS.map(typeName =>
  recursiveNestedTypeName(typeName, ASSIGNMENTS_FIELD_NAME, 'target'),
)
export const ASSIGNMENTS_ODATA_CONTEXT = 'assignments@odata.context'

// Target apps
export const TYPES_WITH_TARGET_APPS_PATH_MAP: Record<
  string,
  { resourcePath: EndpointPath; serviceUrlPath: EndpointPath; targetTypeFieldName: string }
> = {
  [TOP_LEVEL_TYPES.APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME]: {
    resourcePath: '/deviceAppManagement/targetedManagedAppConfigurations',
    serviceUrlPath:
      '/#view/Microsoft_Intune/TargetedAppConfigInstanceBlade/~/fullscreensummary/id/{id}/odataType/undefined',
    targetTypeFieldName: 'targetedManagedAppGroupType',
  },
  [TOP_LEVEL_TYPES.APPLICATION_PROTECTION_ANDROID_TYPE_NAME]: {
    resourcePath: '/deviceAppManagement/androidManagedAppProtections',
    serviceUrlPath:
      '/#view/Microsoft_Intune/PolicyInstanceMenuBlade/~/7/policyId/{id}/policyOdataType/#microsoft.graph.androidManagedAppProtection/policyName/{displayName}',
    targetTypeFieldName: 'appGroupType',
  },
  [TOP_LEVEL_TYPES.APPLICATION_PROTECTION_IOS_TYPE_NAME]: {
    resourcePath: '/deviceAppManagement/iosManagedAppProtections',
    serviceUrlPath:
      '/#view/Microsoft_Intune/PolicyInstanceMenuBlade/~/7/policyId/{id}/policyOdataType/#microsoft.graph.iosManagedAppProtection/policyName/{displayName}',
    targetTypeFieldName: 'appGroupType',
  },
  [TOP_LEVEL_TYPES.APPLICATION_PROTECTION_WINDOWS_TYPE_NAME]: {
    resourcePath: '/deviceAppManagement/windowsManagedAppProtections',
    serviceUrlPath:
      '/#view/Microsoft_Intune/PolicyInstanceMenuBlade/~/7/policyId/{id}/policyOdataType/#microsoft.graph.windowsManagedAppProtection/policyName/{displayName}',
    targetTypeFieldName: 'appGroupType',
  },
}
const TYPES_WITH_TARGET_APPS = Object.keys(TYPES_WITH_TARGET_APPS_PATH_MAP)
export const TYPES_WITH_TARGET_APPS_APPS = TYPES_WITH_TARGET_APPS.map(typeName =>
  recursiveNestedTypeName(typeName, APPS_FIELD_NAME),
)
export const TYPES_WITH_TARGET_APPS_MOBILE_APP_IDENTIFIER = TYPES_WITH_TARGET_APPS_APPS.map(typeName =>
  recursiveNestedTypeName(typeName, 'mobileAppIdentifier'),
)
