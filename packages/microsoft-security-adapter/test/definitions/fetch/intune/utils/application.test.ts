/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  APP_STORE_URL_FIELD_NAME,
  APPLICATION_TYPE_NAME,
  PACKAGE_ID_FIELD_NAME,
} from '../../../../../src/constants/intune'
import { omitApplicationRedundantFields } from '../../../../../src/definitions/fetch/intune/utils'
import { getAdjustedOdataTypeFieldName } from '../../../../../src/definitions/utils/shared'
import { contextMock } from '../../../../mocks'

describe('Intune application fetch utils', () => {
  describe(`${omitApplicationRedundantFields.name}`, () => {
    const applicationValues = {
      id: 'id',
      displayName: 'displayName',
      description: 'description',
      [PACKAGE_ID_FIELD_NAME]: 'packageId',
      [APP_STORE_URL_FIELD_NAME]: 'appStoreUrl',
    }

    describe('when the application value is not an object', () => {
      it('should throw an error', async () => {
        await expect(() =>
          omitApplicationRedundantFields({ value: '', context: contextMock, typeName: 'test' }),
        ).rejects.toThrow()
      })
    })

    describe('when the application type is not androidManagedStoreApp', () => {
      it('should return the application without modifying it', async () => {
        const expendedAppValues = {
          ...applicationValues,
          [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'notAndroidManagedStoreApp',
        }
        expect(
          await omitApplicationRedundantFields({
            value: expendedAppValues,
            context: contextMock,
            typeName: APPLICATION_TYPE_NAME,
          }),
        ).toEqual({ value: expendedAppValues })
      })
    })

    describe('when the application type is androidManagedStoreApp', () => {
      describe('when the application is non-system', () => {
        it('should return the application without modifying it', async () => {
          const expendedAppValues = {
            ...applicationValues,
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
            isSystemApp: false,
          }
          expect(
            await omitApplicationRedundantFields({
              value: expendedAppValues,
              context: contextMock,
              typeName: APPLICATION_TYPE_NAME,
            }),
          ).toEqual({ value: expendedAppValues })
        })
      })

      describe('when the application is system', () => {
        it('should return the application without the packageId and appStoreUrl fields', async () => {
          const expendedAppValues = {
            ...applicationValues,
            [getAdjustedOdataTypeFieldName(APPLICATION_TYPE_NAME)]: 'androidManagedStoreApp',
            isSystemApp: true,
          }
          expect(
            await omitApplicationRedundantFields({
              value: expendedAppValues,
              context: contextMock,
              typeName: APPLICATION_TYPE_NAME,
            }),
          ).toEqual({
            value: {
              ...expendedAppValues,
              [PACKAGE_ID_FIELD_NAME]: undefined,
              [APP_STORE_URL_FIELD_NAME]: undefined,
            },
          })
        })
      })
    })
  })
})
