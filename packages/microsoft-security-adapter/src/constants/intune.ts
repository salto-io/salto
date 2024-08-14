/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

const toIntuneTypeName = (typeName: string): string => `intune_${typeName}`

/* Field names */
// Application fields
export const PACKAGE_ID_FIELD_NAME = 'packageId'
export const APP_IDENTIFIER_FIELD_NAME = 'appIdentifier'
export const APP_STORE_URL_FIELD_NAME = 'appStoreUrl'

/* Type names */
// Top level
export const APPLICATION_TYPE_NAME = toIntuneTypeName('application')
