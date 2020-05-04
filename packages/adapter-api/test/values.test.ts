/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { ElemID } from '../src/element_id'
import { StaticFile, isEqualValues, VariableExpression,
  ReferenceExpression, isStaticFile, calculateStaticFileHash, isPrimitiveValue, TemplateExpression } from '../src/values'

describe('Values', () => {
  describe('ReferenceExpression.createWithValue', () => {
    it('should return correct type', () => {
      const varElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName')
      const varExp = new VariableExpression(varElemId, 17)
      const varExpAsRef = varExp as ReferenceExpression
      const newVarExp = varExpAsRef.createWithValue(undefined)
      expect(newVarExp instanceof VariableExpression).toBe(true)
      expect(newVarExp.value).toBe(undefined)
    })
    it('should return correct value', () => {
      const varElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName')
      const varExp = new VariableExpression(varElemId, 17)
      const newVarExp = varExp.createWithValue(16)
      expect(newVarExp.value).toBe(16)
    })
  })

  describe('VariableExpression', () => {
    it('should not allow referencing anything but a variable', () => {
      expect((() => new VariableExpression(
        new ElemID('salesforce', 'someType')
      ))).toThrow('A variable expression must point to a variable')
    })
    it('should allow referencing a variable', () => {
      expect((() => new VariableExpression(
        new ElemID(ElemID.VARIABLES_NAMESPACE, 'someVar')
      ))).not.toThrow()
    })
  })

  describe('StaticFile', () => {
    it('should have correct static serializedTypeName', () =>
      expect(StaticFile.serializedTypeName).toEqual('StaticFile'))

    describe('equality (direct)', () => {
      it('equals', () => {
        const fileFunc1 = new StaticFile('some/path.ext', Buffer.from('ZOMG'))
        const fileFunc2 = new StaticFile('some/path.ext', Buffer.from('ZOMG'))
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(true)
      })
      it('unequals', () => {
        const fileFunc1 = new StaticFile('some/path.ext', Buffer.from('ZOMG'))
        const fileFunc2 = new StaticFile('some/path.ext', Buffer.from('ZOMG1'))
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(false)
      })
    })
    describe('equality (via isEqualValues)', () => {
      it('equals by hash', () => {
        const fileFunc1 = new StaticFile('some/path.ext', Buffer.from('ZOMG'))
        const fileFunc2 = new StaticFile('some/path.ext', Buffer.from('ZOMG'))
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(true)
      })
      it('unequals', () => {
        const fileFunc1 = new StaticFile('some/path.ext', Buffer.from('ZOMG'))
        const fileFunc2 = new StaticFile('some/path.ext', Buffer.from('ZOMG1'))
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(false)
      })
    })
    it('calculate hash', () => {
      const zOMGBuffer = Buffer.from('ZOMG')
      const hash = '4dc55a74daa147a028360ee5687389d7'
      const zOMGResult = calculateStaticFileHash(zOMGBuffer)
      expect(zOMGResult).toEqual(hash)
    })
    it('isStaticFile when static file', () => expect(isStaticFile(new StaticFile('aa', 'bb'))).toBeTruthy())
    it('isStaticFile when not static file', () => expect(isStaticFile('ZOMG')).toBeFalsy())
  })

  describe('isPrimitiveValue', () => {
    describe('with primitive values', () => {
      const primitiveValues = ['asd', 123, false, undefined, null]
      it('should return true', () => {
        primitiveValues.forEach(val => expect(isPrimitiveValue(val)).toBeTruthy())
      })
    })
    describe('with non primitive values', () => {
      const nonPrimitiveValues = [
        new ReferenceExpression(new ElemID('')),
        new TemplateExpression({ parts: [] }),
        new VariableExpression(new ElemID('var', 'a')),
        new StaticFile('dummy', 'dummy'),
        { a: 1 },
        [1, 2, 3],
      ]
      it('should return false', () => {
        nonPrimitiveValues.forEach(val => expect(isPrimitiveValue(val)).toBeFalsy())
      })
    })
  })
})
