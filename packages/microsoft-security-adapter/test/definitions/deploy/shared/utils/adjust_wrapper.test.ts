/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { invertNaclCase } from '@salto-io/adapter-utils'
import { adjustWrapper, defaultAdjust } from '../../../../../src/definitions/deploy/shared/utils'
import * as AdjustWrapperModule from '../../../../../src/definitions/deploy/shared/utils/adjust_wrapper'
import { contextMock, objectTypeMock } from '../../../../mocks'

const omitReadOnlyFieldsMock = jest.fn()
jest.mock('../../../../../src/definitions/deploy/shared/utils/read_only_fields', () => ({
  omitReadOnlyFields: jest.fn((...args) => omitReadOnlyFieldsMock(...args)),
}))

describe('adjust wrapper utils', () => {
  describe(`${defaultAdjust.name}`, () => {
    beforeEach(() => {
      omitReadOnlyFieldsMock.mockImplementation(async ({ value }) => ({ value }))
    })

    it('should set removed fields as null and remove read-only fields', async () => {
      const changeWithRemovedFields = toChange({
        before: new InstanceElement('test', objectTypeMock, {
          a: 1,
          b: 2,
          c: {
            d: 3,
            e: 4,
          },
          f: [5, 6],
          g: [{ h: 7 }, { i: 8 }],
        }),
        after: new InstanceElement('test', objectTypeMock, {
          a: 1,
          c: {
            d: 3,
          },
          g: [{ h: 7 }],
        }),
      })

      const result = await defaultAdjust({
        value: getChangeData(changeWithRemovedFields).value,
        typeName: objectTypeMock.elemID.typeName,
        context: { ...contextMock, change: changeWithRemovedFields },
      })

      expect(result.value).toEqual({ a: 1, b: null, c: { d: 3, e: null }, f: null, g: [{ h: 7 }] })
      expect(omitReadOnlyFieldsMock).toHaveBeenCalled()
    })

    it('should not modify fields that are different in the change vs in the value', async () => {
      const changeWithDifferentFields = toChange({
        before: new InstanceElement('test', objectTypeMock, {
          a: 1,
          b: 2,
          'nacl_cased@v': 'This field name is different in the change vs in the value',
          'another_field@v': 'This field is not in the value',
        }),
        after: new InstanceElement('test', objectTypeMock, {
          a: 1,
          'nacl_cased@v': 'This field name is different in the change vs in the value',
          'another_field@v': 'This field is not in the value',
        }),
      })

      const result = await defaultAdjust({
        value: _.omit(
          _.mapKeys(getChangeData(changeWithDifferentFields).value, (_val, key) => invertNaclCase(key)),
          ['another.field'],
        ),
        typeName: objectTypeMock.elemID.typeName,
        context: { ...contextMock, change: changeWithDifferentFields },
      })

      expect(result.value).toEqual({
        a: 1,
        b: null,
        'nacl.cased': 'This field name is different in the change vs in the value',
      })
    })
  })

  describe(`${adjustWrapper.name}`, () => {
    it('should call the default adjust function and the provided adjust function', async () => {
      const defaultAdjustMock = jest.spyOn(AdjustWrapperModule, 'defaultAdjust')
      const adjustMock = jest.fn(async ({ value }) => ({ value }))

      const adjust = adjustWrapper(adjustMock)
      await adjust({ value: { a: 1 }, typeName: 'test', context: contextMock })

      expect(defaultAdjustMock).toHaveBeenCalled()
      expect(adjustMock).toHaveBeenCalled()
    })
  })
})
