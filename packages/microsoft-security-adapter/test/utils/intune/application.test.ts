/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { intuneConstants } from '../../../src/constants'
import { odataType, intuneUtils } from '../../../src/utils'

const { APPLICATION_TYPE_NAME } = intuneConstants.TOP_LEVEL_TYPES

const { getAdjustedOdataTypeFieldName } = odataType
const { isManagedGooglePlayApp, isAndroidEnterpriseSystemApp } = intuneUtils.application

describe('Intune application fetch & deploy utils', () => {
  describe(`${isManagedGooglePlayApp.name}`, () => {
    describe('when the application odata type is androidManagedStoreApp', () => {
      it('should return true when isSystemApp is false', () => {
        expect(
          isManagedGooglePlayApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
            isSystemApp: false,
          }),
        ).toEqual(true)
      })

      it('should return true when isSystemApp does not exist', () => {
        expect(
          isManagedGooglePlayApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
          }),
        ).toEqual(true)
      })

      it('should return false when isSystemApp is true', () => {
        expect(
          isManagedGooglePlayApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
            isSystemApp: true,
          }),
        ).toEqual(false)
      })
    })

    describe('when the application odata type is not androidManagedStoreApp', () => {
      it.each([true, false, undefined])('should return false when isSystemApp is %s', isSystemApp => {
        expect(
          isManagedGooglePlayApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'someOtherType',
            isSystemApp,
          }),
        ).toEqual(false)
      })
    })
  })

  describe(`${isAndroidEnterpriseSystemApp.name}`, () => {
    describe('when the application odata type is androidManagedStoreApp', () => {
      it('should return true when isSystemApp is true', () => {
        expect(
          isAndroidEnterpriseSystemApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
            isSystemApp: true,
          }),
        ).toEqual(true)
      })

      it('should return false when isSystemApp is false', () => {
        expect(
          isAndroidEnterpriseSystemApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
            isSystemApp: false,
          }),
        ).toEqual(false)
      })

      it('should return false when isSystemApp does not exist', () => {
        expect(
          isAndroidEnterpriseSystemApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
          }),
        ).toEqual(false)
      })
    })

    describe('when the application odata type is not androidManagedStoreApp', () => {
      it.each([true, false, undefined])('should return false when isSystemApp is %s', isSystemApp => {
        expect(
          isAndroidEnterpriseSystemApp({
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'someOtherType',
            isSystemApp,
          }),
        ).toEqual(false)
      })
    })
  })
})
