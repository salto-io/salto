/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { odataType } from '../shared'
import { APPLICATION_TYPE_NAME } from '../../constants/intune'

const isAndroidManagedStoreApp = (value: Values): boolean =>
  _.get(value, odataType.getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)) === 'androidManagedStoreApp'

const isSystemApp = (value: Values): boolean => Boolean(value.isSystemApp)

/**
 * Check if the application is a managed google play app, which is an app that is managed by the google play store.
 */
export const isManagedGooglePlayApp = (value: Values): boolean => isAndroidManagedStoreApp(value) && !isSystemApp(value)

/**
 * Check if the application is an android enterprise system app, which is a preinstalled system app.
 */
export const isAndroidEnterpriseSystemApp = (value: Values): boolean =>
  isAndroidManagedStoreApp(value) && isSystemApp(value)
