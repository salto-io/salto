/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { APP_IDENTIFIER_FIELD_NAME } from '../../../../../src/constants/intune'
import { transformNonSystemApp } from '../../../../../src/definitions/deploy/intune/utils'
import { contextMock } from '../../../../mocks'

describe('Intune application deploy utils', () => {
  describe(transformNonSystemApp.name, () => {
    describe('when the value is not an object', () => {
      it('should throw an error', async () => {
        await expect(() =>
          transformNonSystemApp({ value: '', context: contextMock, typeName: 'test' }),
        ).rejects.toThrow()
      })
    })

    describe('when the appId is missing', () => {
      it('should throw an error', async () => {
        await expect(() =>
          transformNonSystemApp({ value: {}, context: contextMock, typeName: 'test' }),
        ).rejects.toThrow('Application identifier field is missing or not a string, received: undefined')
      })
    })

    describe('when the appId is not a string', () => {
      it('should throw an error', async () => {
        await expect(() =>
          transformNonSystemApp({ value: { [APP_IDENTIFIER_FIELD_NAME]: 1 }, context: contextMock, typeName: 'test' }),
        ).rejects.toThrow('Application identifier field is missing or not a string, received: 1')
      })
    })

    describe('when the appId is a string', () => {
      it('should return the correct result', async () => {
        const result = await transformNonSystemApp({
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
