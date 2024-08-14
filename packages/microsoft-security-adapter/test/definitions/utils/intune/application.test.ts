/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { APPLICATION_TYPE_NAME } from '../../../../src/constants/intune'
import { isApplicationOfType, isNonSystemApp, PossibleAppType } from '../../../../src/definitions/utils/intune'
import { getAdjustedOdataTypeFieldName } from '../../../../src/definitions/utils/shared'

describe('Intune application fetch & deploy utils', () => {
  describe(`${isApplicationOfType.name}`, () => {
    const possibleTypes: PossibleAppType[] = [
      'androidManagedStoreApp',
      'androidStoreApp',
      'iosStoreApp',
      'managedAndroidStoreApp',
      'managedIosStoreApp',
    ]
    it.each(possibleTypes)(
      'should return true if the application odata field matches %s',
      (applicationType: PossibleAppType) => {
        expect(
          isApplicationOfType(
            { [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: applicationType },
            applicationType,
          ),
        ).toBeTruthy()
      },
    )

    it.each(possibleTypes)(
      'should return false if the application odata field does not match %s',
      (applicationType: PossibleAppType) => {
        expect(
          isApplicationOfType(
            { [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'someOtherType' },
            applicationType,
          ),
        ).toBeFalsy()
      },
    )
  })

  describe(`${isNonSystemApp.name}`, () => {
    it('should return false if isSystemApp does not exist', () => {
      expect(isNonSystemApp({})).toBeFalsy()
    })

    it('should return false if isSystemApp is true', () => {
      expect(isNonSystemApp({ isSystemApp: true })).toBeFalsy()
    })

    it('should return true if isSystemApp is false', () => {
      expect(isNonSystemApp({ isSystemApp: false })).toBeTruthy()
    })
  })
})
