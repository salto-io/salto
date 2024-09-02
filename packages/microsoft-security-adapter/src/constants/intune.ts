/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { fetch as fetchUtils } from '@salto-io/adapter-components'

const { recursiveNestedTypeName } = fetchUtils.element

const toIntuneTypeName = (typeName: string): string => `intune_${typeName}`

/* Field names */
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

// DeviceCompliance fields
export const RESTRICTED_APPS_FIELD_NAME = 'restrictedApps'
export const SCHEDULED_ACTIONS_FIELD_NAME = 'scheduledActionsForRule'
export const SCHEDULED_ACTION_CONFIGURATIONS_FIELD_NAME = 'scheduledActionConfigurations'

/* Type names */
// Top level
export const APPLICATION_TYPE_NAME = toIntuneTypeName('application')
export const APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME = toIntuneTypeName('applicationConfigurationManagedApp')
export const APPLICATION_CONFIGURATION_MANAGED_DEVICE_TYPE_NAME = toIntuneTypeName(
  'applicationConfigurationManagedDevice',
)
export const DEVICE_CONFIGURATION_TYPE_NAME = toIntuneTypeName('deviceConfiguration')
export const DEVICE_CONFIGURATION_SETTING_CATALOG_TYPE_NAME = toIntuneTypeName('deviceConfigurationSettingCatalog')
export const DEVICE_COMPLIANCE_TYPE_NAME = toIntuneTypeName('deviceCompliance')

// Nested types
export const APPLICATION_CONFIGURATION_MANAGED_APP_APPS_TYPE_NAME = recursiveNestedTypeName(
  APPLICATION_CONFIGURATION_MANAGED_APP_TYPE_NAME,
  APPS_FIELD_NAME,
)
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

// Urls
export const SERVICE_BASE_URL = 'https://intune.microsoft.com'
