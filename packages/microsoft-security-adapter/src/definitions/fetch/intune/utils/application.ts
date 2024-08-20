/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { AdjustFunctionSingle } from '../../shared/types'
import {
  APP_IDENTIFIER_FIELD_NAME,
  APP_STORE_URL_FIELD_NAME,
  APPLICATION_TYPE_NAME,
  PACKAGE_ID_FIELD_NAME,
} from '../../../../constants/intune'
import { NAME_ID_FIELD } from '../../shared/defaults'
import { getAdjustedOdataTypeFieldName } from '../../../../utils/shared'
import { isAndroidEnterpriseSystemApp } from '../../../../utils/intune'

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
export const APPLICATION_NAME_PARTS: definitions.fetch.FieldIDPart[] = [
  // Some ManagedAndroidStoreApp instances have the same name, so instead we use the packageId field,
  // which should be consistent across environments.
  { fieldName: APP_IDENTIFIER_FIELD_NAME },
  { fieldName: PACKAGE_ID_FIELD_NAME, condition: value => !value[APP_IDENTIFIER_FIELD_NAME] },
  {
    fieldName: NAME_ID_FIELD.fieldName,
    condition: value => !value[APP_IDENTIFIER_FIELD_NAME] && !value[PACKAGE_ID_FIELD_NAME],
  },
]

/**
 * Omit redundant fields from application based on its type.
 * These omitted fields do not add any value (can be deduced from other fields) and will fail deployment if included.
 */
export const omitApplicationRedundantFields: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, APPLICATION_TYPE_NAME)
  if (isAndroidEnterpriseSystemApp(value)) {
    return {
      value: _.omit(value, [PACKAGE_ID_FIELD_NAME, APP_STORE_URL_FIELD_NAME]),
    }
  }
  return { value }
}
