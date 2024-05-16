/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  StaticFile,
  VariableExpression,
  ReferenceExpression,
  isStaticFile,
  calculateStaticFileHash,
  isPrimitiveValue,
  TemplateExpression,
  TypeReference,
  Values,
  cloneDeepWithoutRefs,
  getStaticFileUniqueName,
  isVariableExpression,
  isTemplateExpression,
  isExpression,
} from '../src/values'
import { BuiltinTypes } from '../src/builtins'
import { ObjectType, InstanceElement, Variable } from '../src/elements'
import { isEqualValues } from '../src/comparison'

describe('Values', () => {
  describe('ReferenceExpression', () => {
    describe('createWithValue', () => {
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
    describe('clone', () => {
      let origRef: ReferenceExpression
      let clonedRef: ReferenceExpression
      beforeEach(() => {
        const targetObj = new ObjectType({
          elemID: new ElemID('salto', 'obj'),
          annotations: {
            val: [1, 2, 3],
          },
        })
        origRef = new ReferenceExpression(
          targetObj.elemID.createNestedID('attr', 'val'),
          targetObj.annotations.val,
          targetObj,
        )
        clonedRef = origRef.clone()
      })
      it('should create a new reference', () => {
        expect(clonedRef).not.toBe(origRef)
      })
      it('should not clone the resolved value or the top level parent', () => {
        expect(clonedRef.value).toBe(origRef.value)
        expect(clonedRef.topLevelParent).toBe(origRef.topLevelParent)
      })
    })
    describe('value', () => {
      let refToValue: ReferenceExpression
      beforeEach(() => {
        const targetInst = new InstanceElement('test', new ObjectType({ elemID: new ElemID('salto', 'test') }), {
          value: 'val',
        })
        refToValue = new ReferenceExpression(
          targetInst.elemID.createNestedID('value'),
          targetInst.value.value,
          targetInst,
        )
      })
      describe('with normal value', () => {
        it('should return the resolved value', () => {
          expect(refToValue.value).toEqual('val')
        })
      })
      describe('with reference value', () => {
        let ref: ReferenceExpression
        beforeEach(() => {
          ref = new ReferenceExpression(new ElemID('salto', 'test', 'attr', 'foo'), refToValue)
        })
        it("should return the target reference's value", () => {
          expect(ref.value).toEqual('val')
        })
      })
      describe('with variable value', () => {
        let ref: ReferenceExpression
        beforeEach(() => {
          const refToRefToValue = new ReferenceExpression(new ElemID('salto', 'test', 'attr', 'foo'), refToValue)
          const variable = new Variable(new ElemID('var', 'ref'), refToRefToValue)
          ref = new ReferenceExpression(new ElemID('salto', 'test', 'attr', 'bla'), variable)
        })
        it("should return the variable's value", () => {
          expect(ref.value).toEqual('val')
        })
      })
    })
  })

  describe('TemplateExpression', () => {
    describe('value accessor', () => {
      let template: TemplateExpression
      beforeEach(() => {
        const refTarget = new ObjectType({
          elemID: new ElemID('salto', 'test'),
          annotations: { value: 'bla' },
        })
        const ref = new ReferenceExpression(
          refTarget.elemID.createNestedID('attr', 'value'),
          refTarget.annotations.value,
          refTarget,
        )
        template = new TemplateExpression({ parts: ['pre ', ref, ' post'] })
      })
      it('should resolve value to a joined string', () => {
        expect(template.value).toEqual('pre bla post')
      })
    })
    it('isTemplateExpression when template expression', () =>
      expect(isTemplateExpression(new TemplateExpression({ parts: [] }))).toEqual(true))
    it('isTemplateExpression when not template expression', () =>
      expect(isTemplateExpression('Definitely not a template expression')).toEqual(false))
  })

  describe('VariableExpression', () => {
    it('should not allow referencing anything but a variable', () => {
      expect(() => new VariableExpression(new ElemID('salesforce', 'someType'))).toThrow(
        'A variable expression must point to a variable',
      )
    })
    it('should allow referencing a variable', () => {
      expect(() => new VariableExpression(new ElemID(ElemID.VARIABLES_NAMESPACE, 'someVar'))).not.toThrow()
    })
    it('isVariableExpression when variable expression', () =>
      expect(isVariableExpression(new VariableExpression(new ElemID(ElemID.VARIABLES_NAMESPACE, 'someVar')))).toEqual(
        true,
      ))
    it('isVariableExpression when not variable expression', () =>
      expect(isVariableExpression('Definitely not a variable expression')).toEqual(false))
  })

  describe('StaticFile', () => {
    describe('constructor', () => {
      it('should normalize the file path', () => {
        const SFile = new StaticFile({ filepath: 'some//path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        expect(SFile.filepath).toEqual('some/path.ext')
      })
      it('should override encoding for templates', () => {
        const SFile = new StaticFile({
          filepath: 'some/path.ext',
          content: Buffer.from('VERY SURPRISING DATA'),
          encoding: 'hex',
          isTemplate: true,
        })
        expect(SFile.encoding).toEqual('utf8')
      })
      it('should throw an error when passed invalid encoding', () => {
        expect(
          () =>
            new StaticFile({
              filepath: 'some/path.ext',
              content: Buffer.from('VERY SURPRISING DATA'),
              encoding: 'invalid' as BufferEncoding,
            }),
        ).toThrow()
      })
    })
    describe('equality (direct)', () => {
      it('equals', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(true)
      })
      it('unequals', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA1') })
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(false)
      })
      it('different encoding', () => {
        const fileFunc1 = new StaticFile({
          filepath: 'some/path.ext',
          content: Buffer.from('VERY SURPRISING DATA'),
          encoding: 'ascii',
        })
        const fileFunc2 = new StaticFile({
          filepath: 'some/path.ext',
          content: Buffer.from('VERY SURPRISING DATA'),
          encoding: 'base64',
        })
        expect(fileFunc1.isEqual(fileFunc2)).toEqual(false)
      })
    })
    describe('equality (via isEqualValues)', () => {
      it('unequals by path with flag false', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.txt', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        expect(isEqualValues(fileFunc1, fileFunc2, { compareByValue: false })).toEqual(false)
      })
      it('unequals by path with flag true', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.txt', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        expect(isEqualValues(fileFunc1, fileFunc2, { compareByValue: true })).toEqual(true)
      })
      it('equals with flag false', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        expect(isEqualValues(fileFunc1, fileFunc2, { compareByValue: false })).toEqual(true)
      })
      it('equals with flag true', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        expect(isEqualValues(fileFunc1, fileFunc2, { compareByValue: true })).toEqual(true)
      })
      it('equals by hash', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(true)
      })
      it('unequals', () => {
        const fileFunc1 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
        const fileFunc2 = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA1') })
        expect(isEqualValues(fileFunc1, fileFunc2)).toEqual(false)
      })
      it('ignores newline differences', () => {
        const s1 = '\r\na\nb\n\r\n\np'
        const s2 = '\na\r\nb\r\n\r\n\r\np'
        expect(isEqualValues(s1, s2)).toEqual(true)
      })

      it('References to inner properties with different values should be equal by default', () => {
        const ref1 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val'), 1)
        const ref2 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val'), 2)
        expect(isEqualValues(ref1, ref2)).toEqual(true)
      })

      it('References to inner properties with the same should not be equal when compareReferencesByValue is true', () => {
        const ref1 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val1'), 1)
        const ref2 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val1'), 2)
        expect(isEqualValues(ref1, ref2, { compareByValue: true })).toEqual(false)
      })

      it('References to inner properties with the same should not be equal', () => {
        const ref1 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val1'), 1)
        const ref2 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val1'), 1)
        expect(isEqualValues(ref1, ref2, { compareByValue: true })).toEqual(true)
      })

      it('References to different inner properties with the same value should be equal', () => {
        const ref1 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val1'), 1)
        const ref2 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val2'), 1)
        expect(isEqualValues(ref1, ref2, { compareByValue: true })).toEqual(true)
      })

      it('Reference should not be equal to its resolved value by default', () => {
        const ref1 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val1'), 1)
        expect(isEqualValues(ref1, 1)).toEqual(false)
      })

      it('Reference should not be equal to its resolved value when compareReferencesByValue is true', () => {
        const ref1 = new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'inst', 'val1'), 1)
        expect(isEqualValues(ref1, 1, { compareByValue: true })).toEqual(true)
      })

      it('Comparing circular dependencies should return true', () => {
        const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }))

        instance.value.a = {
          ref: new ReferenceExpression(instance.elemID.createNestedID('a')),
        }

        instance.value.a.ref.value = instance.value.a

        expect(isEqualValues(instance, instance.clone(), { compareByValue: true })).toEqual(true)
      })
    })
    it('calculate hash', () => {
      const vsdBuffer = Buffer.from('VERY SURPRISING DATA')
      const hash = 'a1b185cb49337d10f0addd14c90ec34a'
      const zOMGResult = calculateStaticFileHash(vsdBuffer)
      expect(zOMGResult).toEqual(hash)
    })
    it('getContent', async () => {
      const SFile = new StaticFile({ filepath: 'some/path.ext', content: Buffer.from('VERY SURPRISING DATA') })
      expect(await SFile.getContent()).toEqual(Buffer.from('VERY SURPRISING DATA'))
    })
    it('isStaticFile when static file', () =>
      expect(isStaticFile(new StaticFile({ filepath: 'aa', hash: 'bb' }))).toEqual(true))
    it('isStaticFile when not static file', () => expect(isStaticFile('VERY SURPRISING DATA')).toEqual(false))
    it('getStaticFileUniqueName', () => {
      const result = getStaticFileUniqueName({ filepath: 'some/path.ext', hash: 'hash' })
      expect(result).toEqual('some/path.ext-hash')
    })
  })

  describe('isPrimitiveValue', () => {
    describe('with primitive values', () => {
      const primitiveValues = ['asd', 123, false, undefined, null]
      it('should return true', () => {
        primitiveValues.forEach(val => expect(isPrimitiveValue(val)).toEqual(true))
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
        nonPrimitiveValues.forEach(val => expect(isPrimitiveValue(val)).toEqual(false))
      })
    })
  })

  describe('isExpression', () => {
    it('should return true for template expression', () => {
      expect(isExpression(new TemplateExpression({ parts: [] }))).toEqual(true)
    })
  })

  describe('TypeReference', () => {
    const idString = 'salesforce.some_id'
    const elemID = ElemID.fromFullName(idString)

    it('should throw error when no element source and no type', async () => {
      const ref = new TypeReference(elemID)
      await expect(ref.getResolvedValue()).rejects.toEqual(
        new Error(
          `Can not resolve value of reference with ElemID ${elemID.getFullName()} without elementsSource because value does not exist`,
        ),
      )
    })

    it('should throw error when no elemID is not top level', async () => {
      const createReference = (): TypeReference =>
        new TypeReference(ElemID.fromFullName('A.nested.instance.id.should.throw.error'))
      expect(createReference).toThrow(
        new Error(
          'Invalid id for type reference: A.nested.instance.id.should.throw.error. Type reference must be top level.',
        ),
      )
    })

    it('should resolve from value if possible', async () => {
      const ref = new TypeReference(elemID, BuiltinTypes.STRING)
      expect(
        await ref.getResolvedValue({
          list: jest.fn(),
          get: async () => BuiltinTypes.NUMBER,
          has: jest.fn(),
          getAll: jest.fn(),
        }),
      ).toEqual(BuiltinTypes.STRING)
    })

    it('should resolve from element source if value is undefined', async () => {
      const ref = new TypeReference(elemID)
      expect(
        await ref.getResolvedValue({
          list: jest.fn(),
          get: async () => BuiltinTypes.NUMBER,
          has: jest.fn(),
          getAll: jest.fn(),
        }),
      ).toEqual(BuiltinTypes.NUMBER)
    })

    it("should return empty obj with ID if element returns undefined and type doesn't exist", async () => {
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

  describe('cloneDeepWithoutRefs', () => {
    let referenceTarget: ObjectType
    let originalValues: Values
    let clonedValues: Values
    beforeEach(() => {
      referenceTarget = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        annotations: {
          bla: 'bla',
        },
      })
      originalValues = {
        obj: { a: 1 },
        arr: [1, 2, 3],
        ref: new ReferenceExpression(referenceTarget.elemID, referenceTarget, referenceTarget),
        template: new TemplateExpression({
          parts: [
            'a',
            new ReferenceExpression(referenceTarget.elemID.createNestedID('attr', 'bla'), 'bla', referenceTarget),
            'b',
          ],
        }),
        type: new TypeReference(referenceTarget.elemID, referenceTarget),
      }
      clonedValues = cloneDeepWithoutRefs(originalValues)
    })
    it('should clone objects, arrays and references', () => {
      expect(clonedValues.obj).toEqual(originalValues.obj)
      expect(clonedValues.obj).not.toBe(originalValues.obj)

      expect(clonedValues.arr).toEqual(originalValues.arr)
      expect(clonedValues.arr).not.toBe(originalValues.arr)

      expect(clonedValues.ref).toEqual(originalValues.ref)
      expect(clonedValues.ref).not.toBe(originalValues.ref)

      expect(clonedValues.template).toEqual(originalValues.template)
      expect(clonedValues.template).not.toBe(originalValues.template)

      expect(clonedValues.type).toEqual(originalValues.type)
      expect(clonedValues.type).not.toBe(originalValues.type)
    })
    it('should not clone reference values', () => {
      expect(clonedValues.ref.resValue).toBe(originalValues.ref.resValue)
      expect(clonedValues.ref.topLevelParent).toBe(originalValues.ref.topLevelParent)

      const clonedRefInTemplate = clonedValues.template.parts[1]
      const origRefInTemplate = originalValues.template.parts[1]
      expect(clonedRefInTemplate.resValue).toBe(origRefInTemplate.resValue)
      expect(clonedRefInTemplate.topLevelParent).toBe(origRefInTemplate.topLevelParent)

      expect(clonedValues.type.type).toBe(originalValues.type.type)
    })
  })
})
