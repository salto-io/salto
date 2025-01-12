/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { concatAdjustFunctions } from '../src/adjust_utils'

describe('adjust utils', () => {
  describe(`${concatAdjustFunctions.name}`, () => {
    it('should return a function that applies all the given adjust functions in the order they were given', async () => {
      const adjustFunc1 = jest.fn().mockReturnValue({ value: { field: 'arg1' } })
      const adjustFunc2 = jest.fn().mockReturnValue({ value: { field: 'arg2' }, someValue: 'test' })
      const adjustFunc3 = jest.fn().mockReturnValue({ value: { field: 'arg3' }, someOtherValue: 'test-2' })
      const concatFunc = concatAdjustFunctions(adjustFunc1, adjustFunc2, adjustFunc3)

      const argsWithoutValue = { context: {}, typeName: 'testTypeName' }
      const result = await concatFunc({ value: { field: 'arg' }, ...argsWithoutValue })
      expect(adjustFunc1).toHaveBeenCalledWith({ value: { field: 'arg' }, ...argsWithoutValue })
      expect(adjustFunc2).toHaveBeenCalledWith({ value: { field: 'arg1' }, ...argsWithoutValue })
      expect(adjustFunc3).toHaveBeenCalledWith({ value: { field: 'arg2' }, ...argsWithoutValue, someValue: 'test' })
      expect(result).toEqual({
        value: { field: 'arg3' },
        ...argsWithoutValue,
        someValue: 'test',
        someOtherValue: 'test-2',
      })
    })
  })
})
