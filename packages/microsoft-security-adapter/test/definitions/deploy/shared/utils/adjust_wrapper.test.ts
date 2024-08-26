/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
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
        before: new InstanceElement('test', objectTypeMock, { a: 1, b: 2 }),
        after: new InstanceElement('test', objectTypeMock, { a: 1 }),
      })

      const result = await defaultAdjust({
        value: getChangeData(changeWithRemovedFields).value,
        typeName: objectTypeMock.elemID.typeName,
        context: { ...contextMock, change: changeWithRemovedFields },
      })

      expect(result.value).toEqual({ a: 1, b: null })
      expect(result.context?.change).toBeDefined()
      expect(getChangeData(result.context?.change as Change<InstanceElement>).value).toEqual({ a: 1, b: null })
      expect(omitReadOnlyFieldsMock).toHaveBeenCalled()
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
