/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { intuneConstants } from '../../../../../src/constants'
import {
  omitApplicationRedundantFields,
  transformManagedGooglePlayApp,
} from '../../../../../src/definitions/deploy/intune/utils/application'
import { odataType } from '../../../../../src/utils'
import { contextMock } from '../../../../mocks'

const { getAdjustedOdataTypeFieldName } = odataType

const { APP_IDENTIFIER_FIELD_NAME, PACKAGE_ID_FIELD_NAME, APP_STORE_URL_FIELD_NAME, APPLICATION_TYPE_NAME } =
  intuneConstants

const isManagedGooglePlayAppMock = jest.fn()

jest.mock('../../../../../src/utils', () => ({
  ...jest.requireActual<{}>('../../../../../src/utils'),
  intuneUtils: {
    application: {
      ...jest.requireActual<{}>('../../../../../src/utils/intune/application'),
      isManagedGooglePlayApp: (...args: unknown[]) => isManagedGooglePlayAppMock(...args),
    },
  },
}))

describe('Intune application deploy utils', () => {
  describe(transformManagedGooglePlayApp.name, () => {
    describe('when the app is not a managed google play app', () => {
      beforeEach(() => {
        isManagedGooglePlayAppMock.mockReturnValue(false)
      })

      it('should throw an error', async () => {
        await expect(() =>
          transformManagedGooglePlayApp({
            value: { [APP_IDENTIFIER_FIELD_NAME]: 'test' },
            context: contextMock,
            typeName: 'test',
          }),
        ).rejects.toThrow("The application is not a managed google play app, received: { appIdentifier: 'test' }")
      })
    })

    describe('when the app is a managed google play app', () => {
      beforeEach(() => {
        isManagedGooglePlayAppMock.mockReturnValue(true)
      })

      describe('when the value is not an object', () => {
        it('should throw an error', async () => {
          await expect(() =>
            transformManagedGooglePlayApp({ value: '', context: contextMock, typeName: 'test' }),
          ).rejects.toThrow()
        })
      })

      describe('when the appId is missing', () => {
        it('should throw an error', async () => {
          await expect(() =>
            transformManagedGooglePlayApp({ value: {}, context: contextMock, typeName: 'test' }),
          ).rejects.toThrow('Application identifier field is missing or not a string, received: undefined')
        })
      })

      describe('when the appId is not a string', () => {
        it('should throw an error', async () => {
          await expect(() =>
            transformManagedGooglePlayApp({
              value: { [APP_IDENTIFIER_FIELD_NAME]: 1 },
              context: contextMock,
              typeName: 'test',
            }),
          ).rejects.toThrow('Application identifier field is missing or not a string, received: 1')
        })
      })

      describe('when the appId is a string', () => {
        it('should return the correct result', async () => {
          const result = await transformManagedGooglePlayApp({
            value: { [APP_IDENTIFIER_FIELD_NAME]: 'test' },
            context: contextMock,
            typeName: 'test',
          })
          expect(result).toEqual({
            value: {
              productIds: ['app:test'],
            },
          })
        })
      })
    })
  })

  describe(omitApplicationRedundantFields.name, () => {
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
