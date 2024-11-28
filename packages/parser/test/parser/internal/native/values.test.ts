/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { parseValue } from '../../../../src/parser/internal/native/consumers/values'

describe('values', () => {
  describe('parseValue', () => {
    describe('when value is string', () => {
      it('should return string value', () => {
        const value = '"value"'
        expect(parseValue(value)).toEqual('value')
      })
    })
    describe('when value is number', () => {
      it('should return number value', () => {
        const value = '1'
        expect(parseValue(value)).toEqual(1)
      })
    })
    describe('when value is boolean', () => {
      it('should return boolean value', () => {
        const value = 'true'
        expect(parseValue(value)).toEqual(true)
      })
    })
    describe('when value is reference expression', () => {
      const value = new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'someInstance'))
      it('should return reference expression value', () => {
        expect(parseValue('adapter.someType.instance.someInstance')).toEqual(value)
      })
    })
  })
})
