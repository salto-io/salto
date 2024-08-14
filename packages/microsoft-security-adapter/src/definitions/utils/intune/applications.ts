/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { getAdjustedOdataTypeFieldName } from '../shared'
import { APPLICATION_TYPE_NAME } from '../../../constants/intune'

export type PossibleAppType =
  | 'androidManagedStoreApp'
  | 'androidStoreApp'
  | 'iosStoreApp'
  | 'managedAndroidStoreApp'
  | 'managedIosStoreApp'

const APPLICATION_TYPES: Record<PossibleAppType, string> = {
  androidManagedStoreApp: 'androidManagedStoreApp',
  androidStoreApp: 'androidStoreApp',
  iosStoreApp: 'iosStoreApp',
  managedAndroidStoreApp: 'managedAndroidStoreApp',
  managedIosStoreApp: 'managedIosStoreApp',
}

/**
 * Check if the application is of the given type, according to the application odata type field.
 */
export const isApplicationOfType = (value: Values, type: PossibleAppType): boolean => {
  const appType = _.get(value, getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME))
  if (Object.keys(APPLICATION_TYPES).includes(appType)) {
    return APPLICATION_TYPES[appType as PossibleAppType] === type
  }
  return false
}

/**
 * Check if the application is a not a system app (i.e. not managed by the tenant).
 * Please note that, though it may be confusing, we check the negation of the isSystemApp field because we need the field to be present.
 */
export const isNonSystemApp = (value: Values): boolean => value.isSystemApp === false
