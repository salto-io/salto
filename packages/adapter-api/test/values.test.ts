/*
*                      Copyright 2021 Salto Labs Ltd.
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
  ReferenceExpression, isStaticFile, calculateStaticFileHash, isPrimitiveValue, TemplateExpression, TypeReference } from '../src/values'
import { BuiltinTypes } from '../src/builtins'

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
    describe('equality (direct)', () => {
      it('equals', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG') })
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(true)
      })
      it('unequals', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG1') })
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(false)
      })
    })
    describe('equality (via isEqualValues)', () => {
      it('equals by hash', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG') })
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(true)
      })
      it('unequals', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('ZOMG1') })
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(false)
      })
      it('ignores newline differences', () => {
        const s1 = '\r\na\nb\n\r\n\np'
        const s2 = '\na\r\nb\r\n\r\n\r\np'
        expect(isEqualValues(s1, s2)).toBeTruthy()
      })
    })
    it('calculate hash', () => {
      const zOMGBuffer = Buffer.from('ZOMG')
      const hash = '4dc55a74daa147a028360ee5687389d7'
      const zOMGResult = calculateStaticFileHash(zOMGBuffer)
      expect(zOMGResult).toEqual(hash)
    })
    it('isStaticFile when static file', () => expect(isStaticFile(new StaticFile({ filepath: 'aa', hash: 'bb' }))).toBeTruthy())
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
        new StaticFile({ filepath: 'dummy', hash: 'dummy' }),
        { a: 1 },
        [1, 2, 3],
      ]
      it('should return false', () => {
        nonPrimitiveValues.forEach(val => expect(isPrimitiveValue(val)).toBeFalsy())
      })
    })
  })
  describe('TypeReference', () => {
    const idString = 'salesforce.someid'
    const elemID = ElemID.fromFullName(idString)

    it('should throw error when no element source and no type', async () => {
      const ref = new TypeReference(elemID)
      await expect(ref.getResolvedValue()).rejects.toEqual(new Error(`Can not resolve value of reference with ElemID ${elemID.getFullName()} without elementsSource because value does not exist`))
    })

    it('should throw error when no elemID is not top level', async () => {
      const createReference = (): TypeReference =>
        new TypeReference(ElemID.fromFullName('A.nested.instance.id.should.throw.error'))
      expect(createReference).toThrow(new Error('Invalid id for type reference: A.nested.instance.id.should.throw.error. Type reference must be top level.'))
    })

    it('should resolve with element source if possible', async () => {
      const ref = new TypeReference(elemID, BuiltinTypes.STRING)
      expect(await ref.getResolvedValue({
        list: jest.fn(),
        get: async () => BuiltinTypes.NUMBER,
        has: jest.fn(),
        getAll: jest.fn(),
      })).toEqual(BuiltinTypes.NUMBER)
    })

    it('should resolve without element source if it returns undefined', async () => {
      const ref = new TypeReference(elemID, BuiltinTypes.STRING)
      expect(await ref.getResolvedValue({
        list: jest.fn(),
        get: async () => undefined,
        has: jest.fn(),
        getAll: jest.fn(),
      })).toEqual(BuiltinTypes.STRING)
    })

    it('should return empty obj with ID if element returns undefined and type doesnt exist', async () => {
      const ref = new TypeReference(elemID)
      const res = await ref.getResolvedValue({
        list: jest.fn(),
        get: async () => undefined,
        has: jest.fn(),
        getAll: jest.fn(),
      })
      expect(res.elemID.getFullName()).toEqual(elemID.getFullName())
    })
  })
})
