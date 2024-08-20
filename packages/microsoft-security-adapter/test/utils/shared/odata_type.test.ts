/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ODATA_PREFIX, ODATA_TYPE_FIELD } from '../../../src/constants'
import { getAdjustedOdataTypeFieldName, transformOdataTypeField } from '../../../src/utils/shared'
import { contextMock } from '../../mocks'

describe('Odata type utils', () => {
  describe(`${getAdjustedOdataTypeFieldName.name}`, () => {
    it('should return the correct adjusted field name', () => {
      expect(getAdjustedOdataTypeFieldName('test')).toEqual('test_type')
    })
  })

  describe(`${transformOdataTypeField.name}`, () => {
    describe('when the operation is fetch', () => {
      const transformOdataTypeFieldFetch = transformOdataTypeField('fetch')

      describe('when the value is not an object', () => {
        it('should throw an error', async () => {
          await expect(() =>
            transformOdataTypeFieldFetch({ value: 'test', typeName: 'testTypeName', context: contextMock }),
          ).rejects.toThrow()
        })
      })

      describe('when the existing odata value is not a string', () => {
        it('should return the original value', async () => {
          expect(
            await transformOdataTypeFieldFetch({
              value: { [ODATA_TYPE_FIELD]: 1 },
              typeName: 'testTypeName',
              context: contextMock,
            }),
          ).toEqual({ value: { [ODATA_TYPE_FIELD]: 1 } })
        })
      })

      describe('when the existing odata value is not in the correct format', () => {
        it('should return the adjusted field with undefined value', async () => {
          expect(
            await transformOdataTypeFieldFetch({
              value: { [ODATA_TYPE_FIELD]: 'test' },
              typeName: 'testTypeName',
              context: contextMock,
            }),
          ).toEqual({ value: { [ODATA_TYPE_FIELD]: undefined } })
        })
      })

      describe('when the existing odata value is in the correct format', () => {
        it('should return the adjusted field with the correct value', async () => {
          expect(
            await transformOdataTypeFieldFetch({
              value: { [ODATA_TYPE_FIELD]: `${ODATA_PREFIX}testType` },
              typeName: 'testTypeName',
              context: contextMock,
            }),
          ).toEqual({ value: { [getAdjustedOdataTypeFieldName('testTypeName')]: 'testType' } })
        })
      })
    })

    describe('when the operation is deploy', () => {
      const transformOdataTypeFieldDeploy = transformOdataTypeField('deploy')

      describe('when the value is not an object', () => {
        it('should throw an error', async () => {
          await expect(() =>
            transformOdataTypeFieldDeploy({ value: 'test', typeName: 'testTypeName', context: contextMock }),
          ).rejects.toThrow()
        })
      })

      describe('when the existing odata value is not a string', () => {
        it('should return the original value', async () => {
          expect(
            await transformOdataTypeFieldDeploy({
              value: { testTypeName_type: 1 },
              typeName: 'testTypeName',
              context: contextMock,
            }),
          ).toEqual({ value: { testTypeName_type: 1 } })
        })
      })

      describe('when the existing odata value is in the correct format', () => {
        it('should return the adjusted field with the correct value', async () => {
          expect(
            await transformOdataTypeFieldDeploy({
              value: { testTypeName_type: 'testType' },
              typeName: 'testTypeName',
              context: contextMock,
            }),
          ).toEqual({ value: { [ODATA_TYPE_FIELD]: `${ODATA_PREFIX}testType` } })
        })
      })
    })
  })
})
