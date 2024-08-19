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

/* Type names */
// Top level
export const APPLICATION_TYPE_NAME = toIntuneTypeName('application')
export const APPLICATION_CONFIGURATION_MANAGED_APP = toIntuneTypeName('applicationConfigurationManagedApp')

// Nested types
export const APPLICATION_CONFIGURATION_MANAGED_APP_APPS = recursiveNestedTypeName(
  APPLICATION_CONFIGURATION_MANAGED_APP,
  APPS_FIELD_NAME,
)
