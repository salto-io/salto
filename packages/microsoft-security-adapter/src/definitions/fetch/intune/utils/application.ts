/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { APP_IDENTIFIER_FIELD_NAME, APPLICATION_TYPE_NAME, PACKAGE_ID_FIELD_NAME } from '../../../../constants/intune'
import { NAME_ID_FIELD } from '../../shared/defaults'
import { getAdjustedOdataTypeFieldName } from '../../../../utils/shared'

export const APPLICATION_FIELDS_TO_OMIT: Record<string, { omit: true }> = {
  uploadState: { omit: true },
  publishingState: { omit: true },
  isAssigned: { omit: true },
  isPrivate: { omit: true },
  supportsOemConfig: { omit: true },
  dependentAppCount: { omit: true },
  supersedingAppCount: { omit: true },
  supersededAppCount: { omit: true },
  usedLicenseCount: { omit: true },
  totalLicenseCount: { omit: true },
  appTracks: { omit: true },
}

/* The following parts are shared for the application elemID definition and its path definition */
export const APPLICATION_TYPE_PART: definitions.fetch.FieldIDPart = {
  fieldName: getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME),
}

// Some app instances have the same name, so we use other identifiers,
// that should be consistent between envs, whenever possible
export const APPLICATION_NAME_PARTS: definitions.fetch.FieldIDPart[] = [
  // Identifier for: androidManagedStoreApp, androidStoreApp, androidForWorkApp
  { fieldName: APP_IDENTIFIER_FIELD_NAME },
  // Identifier for: androidLobApp, managedAndroidLobApp, managedAndroidStoreApp
  { fieldName: PACKAGE_ID_FIELD_NAME, condition: value => !value[APP_IDENTIFIER_FIELD_NAME] },
  {
    fieldName: NAME_ID_FIELD.fieldName,
    condition: value => !value[APP_IDENTIFIER_FIELD_NAME] && !value[PACKAGE_ID_FIELD_NAME],
  },
]
