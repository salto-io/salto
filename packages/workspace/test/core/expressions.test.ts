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
import _ from 'lodash'
import {
  ElemID,
  ObjectType,
  BuiltinTypes,
  InstanceElement,
  Element,
  ReferenceExpression,
  VariableExpression,
  TemplateExpression,
  ListType,
  Variable,
  isVariableExpression,
  isReferenceExpression,
  StaticFile,
} from '@salto-io/adapter-api'
import {
  TestFuncImpl,
} from '../parser/functions.test'
import { resolve, UnresolvedReference, CircularReference } from '../../src/expressions'

describe('Test Salto Expressions', () => {
  const refTo = ({ elemID }: { elemID: ElemID }, ...path: string[]): ReferenceExpression => (
    new ReferenceExpression(
      elemID.createNestedID(...path)
    )
  )

  describe('Reference Expression', () => {
    const baseElemID = new ElemID('salto', 'base')
    const varElemID = new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName')
    const falsyVarElemID = new ElemID(ElemID.VARIABLES_NAMESPACE, 'falsyVarName')
    const variable = new Variable(varElemID, 7)
    const falsyVariable = new Variable(falsyVarElemID, false)
    const varRefElemID = new ElemID(ElemID.VARIABLES_NAMESPACE, 'varRefName')
    const objElemID = new ElemID('salto', 'obj')
    const base = new ObjectType({
      elemID: baseElemID,
      fields: {
        simple: { type: BuiltinTypes.STRING, annotations: { anno: 'field_anno' } },
        obj: {
          type: new ObjectType({
            elemID: objElemID,
            fields: { value: { type: BuiltinTypes.STRING } },
          }),
        },
        arr: { type: new ListType(BuiltinTypes.STRING) },
      },
      annotations: {
        anno: 'base_anno',
      },
    })

    const baseInst = new InstanceElement('inst', base, {
      simple: 'simple',
      obj: { value: 'nested' },
      arr: ['A', 'B'],
    })

    const varRef = new Variable(varRefElemID,
      new ReferenceExpression(baseInst.elemID.createNestedID('simple')))

    const simpleRefType = new ObjectType({
      elemID: new ElemID('salto', 'simple_ref_type'),
    })
    const noRefInst = new InstanceElement('noref', simpleRefType, {
      test: `${baseInst.elemID.getFullName()}.simple`,
    })

    const simpleRefInst = new InstanceElement('simpleref', simpleRefType, {
      test: refTo(baseInst, 'simple'),
    })

    const varRefInst = new InstanceElement('varref', simpleRefType, {
      test: new VariableExpression(varElemID),
    })

    const falsyVarRefInst = new InstanceElement('falsyvarref', simpleRefType, {
      test: new VariableExpression(falsyVarElemID),
    })

    const nestedRefInst = new InstanceElement('nesetedref', simpleRefType, {
      test: refTo(baseInst, 'obj', 'value'),
    })

    const arrayRefInst = new InstanceElement('arrayref', simpleRefType, {
      test0: refTo(baseInst, 'arr', '0'),
      test1: refTo(baseInst, 'arr', '1'),
    })

    const annoRefInst = new InstanceElement('annoref', simpleRefType, {
      test: refTo(base, 'attr', 'anno'),
    })

    const fieldAnnoRefInst = new InstanceElement('fieldref', simpleRefType, {
      test: refTo(base, 'field', 'simple', 'anno'),
    })

    const chainedRefInst = new InstanceElement('chainedref', simpleRefType, {
      test: refTo(simpleRefInst, 'test'),
    })

    const noPathInst = new InstanceElement('nopath', simpleRefType, {
      test: refTo(baseInst),
    })

    const objectRefID = new ElemID('salto', 'objref')
    const objectRef = new ObjectType({
      elemID: objectRefID,
      fields: {
        ref: {
          type: BuiltinTypes.STRING,
          annotations: { anno: refTo(base, 'attr', 'anno') },
        },
      },
      annotations: {
        anno: refTo(base, 'attr', 'anno'),
      },
    })

    const instanceWithFunctions = new InstanceElement('withfunctions', base, {
      simple: new TestFuncImpl('simple', ['aaa']),
      several: new TestFuncImpl('several', [false, 123]),
      list: new TestFuncImpl('list', [['aaa', true, 123]]),
      mixed: new TestFuncImpl('mixed', ['aaa', [1, 2, 'aa']]),
      file: new StaticFile({ filepath: 'some/path.ext', hash: 'hash' }),
    })

    const elements = [
      base,
      variable,
      falsyVariable,
      baseInst,
      noRefInst,
      simpleRefInst,
      varRefInst,
      falsyVarRefInst,
      varRef,
      nestedRefInst,
      arrayRefInst,
      annoRefInst,
      fieldAnnoRefInst,
      chainedRefInst,
      noPathInst,
      objectRef,
      instanceWithFunctions,
    ]

    const resolved = resolve(elements)

    const findResolved = <T extends Element>(
      target: Element): T => resolved.filter(
        e => _.isEqual(e.elemID, target.elemID)
      )[0] as T

    it('should not modify simple values', () => {
      const element = findResolved<InstanceElement>(noRefInst)
      expect(element.value.test).toEqual(`${baseInst.elemID.getFullName()}.simple`)
    })

    it('should resolve simple variable references', () => {
      const element = findResolved<InstanceElement>(simpleRefInst)
      expect(isVariableExpression(element.value.test)).toBe(false)
      expect(element.value.test.value).toEqual('simple')
    })

    it('should resolve variable references', () => {
      const element = findResolved<InstanceElement>(varRefInst)
      expect(isVariableExpression(element.value.test)).toBe(true)
      expect(element.value.test.value).toEqual(7)
    })

    it('should resolve a falsy variable references', () => {
      const element = findResolved<InstanceElement>(falsyVarRefInst)
      expect(isVariableExpression(element.value.test)).toBe(true)
      expect(element.value.test.value).toEqual(false)
    })

    it('should resolve a variable value which is a reference', () => {
      const element = findResolved<Variable>(varRef)
      expect(isReferenceExpression(element.value)).toBe(true)
      expect(element.value.value).toEqual('simple')
    })

    it('should keep JS refs in Field', () => {
      const element = findResolved<ObjectType>(objectRef)
      expect(element.fields.ref.type).toBe(BuiltinTypes.STRING)
      expect(element.fields.ref.parent).toBe(element)
    })

    describe('functions', () => {
      let element: InstanceElement
      beforeAll(() => {
        element = findResolved<InstanceElement>(instanceWithFunctions)
      })
      it('should resolve simple params', () => {
        expect(element.value).toHaveProperty('simple')
        expect(element.value.simple.funcName).toEqual('simple')
        expect(element.value.simple.parameters).toEqual(['aaa'])
      })
      it('should resolve several params', () => {
        expect(element.value).toHaveProperty('several')
        expect(element.value.several.funcName).toEqual('several')
        expect(element.value.several.parameters).toEqual([false, 123])
      })
      it('should resolve list params', () => {
        expect(element.value).toHaveProperty('list')
        expect(element.value.list.funcName).toEqual('list')
        expect(element.value.list.parameters).toEqual([['aaa', true, 123]])
      })
      it('should resolve mixed params', () => {
        expect(element.value).toHaveProperty('mixed')
        expect(element.value.mixed.funcName).toEqual('mixed')
        expect(element.value.mixed.parameters).toEqual(['aaa', [1, 2, 'aa']])
      })
    })

    it('should not mutate parameters to resolve function', () => {
      expect(simpleRefInst.value.test).toBeInstanceOf(ReferenceExpression)
      expect(simpleRefInst.value.test.resValue).toBeUndefined()
    })

    it('should resolve nested references', () => {
      const element = findResolved<InstanceElement>(nestedRefInst)
      expect(element.value.test.value).toEqual('nested')
    })

    it('should resolve array references', () => {
      const element = findResolved<InstanceElement>(arrayRefInst)
      expect(element.value.test0.value).toEqual('A')
      expect(element.value.test1.value).toEqual('B')
    })

    it('should resolve annotations references', () => {
      const element = findResolved<InstanceElement>(annoRefInst)
      expect(element.value.test.value).toEqual('base_anno')
    })

    it('should resolve field annotation values references', () => {
      const element = findResolved<InstanceElement>(fieldAnnoRefInst)
      expect(element.value.test.value).toEqual('field_anno')
    })

    it('should resolve references with no path', () => {
      const element = findResolved<InstanceElement>(noPathInst)
      expect(element.value.test.value).toEqual(baseInst)
    })

    it('should resolve chained references', () => {
      const element = findResolved<InstanceElement>(chainedRefInst)
      expect(element.value.test.value).toEqual('simple')
    })

    it('should detect reference cycles', () => {
      const firstRef = new InstanceElement('first', simpleRefType, {})
      const secondRef = new InstanceElement('second', simpleRefType, {})
      firstRef.value.test = refTo(secondRef, 'test')
      secondRef.value.test = refTo(firstRef, 'test')
      const chained = [firstRef, secondRef]
      const inst = resolve(chained)[0] as InstanceElement
      expect(inst.value.test.value).toBeInstanceOf(CircularReference)
    })

    it('should fail on unresolvable', () => {
      const firstRef = new InstanceElement('first', simpleRefType, {})
      const secondRef = new InstanceElement('second', simpleRefType, {
        test: refTo(firstRef, 'test'),
      })
      const bad = [firstRef, secondRef]
      const res = resolve(bad)[1] as InstanceElement
      expect(res.value.test.value).toBeInstanceOf(UnresolvedReference)
    })

    it('should fail on unresolvable roots', () => {
      const target = new ElemID('noop', 'test')
      const firstRef = new InstanceElement(
        'first',
        simpleRefType,
        { test: new ReferenceExpression(target) },
      )
      const bad = [firstRef]
      const res = resolve(bad)[0] as InstanceElement
      expect(res.value.test.value).toBeInstanceOf(UnresolvedReference)
      expect(res.value.test.value.target).toEqual(target)
    })

    it('should use additional context', () => {
      const context = new InstanceElement('second', simpleRefType, {})
      const firstRef = new InstanceElement(
        'first',
        simpleRefType,
        { test: refTo(context) },
      )
      const bad = [firstRef]
      const res = resolve(bad, [context])[0] as InstanceElement
      const noContextRes = resolve(bad)[0] as InstanceElement
      expect(noContextRes.value.test.value).toBeInstanceOf(UnresolvedReference)
      expect(res.value.test.value).toBeInstanceOf(InstanceElement)
      expect(res.value.test.value).toEqual(context)
    })

    it('should not resolve additional context', () => {
      const inst = new InstanceElement('second', simpleRefType, {})
      const refToInst = new ReferenceExpression(inst.elemID)
      const context = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'),
        refToInst)
      const refInst = new InstanceElement(
        'first',
        simpleRefType,
        { test: new VariableExpression(context.elemID) },
      )
      const res = resolve([refInst], [context, inst])
      expect(res).toHaveLength(1)
      expect((res[0] as InstanceElement).value.test.value).toEqual(inst)
    })

    it('should use elements over additional context', () => {
      const context = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'), 'a')
      const inputElem = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'), 'b')
      const refInst = new InstanceElement(
        'first',
        simpleRefType,
        { test: new VariableExpression(context.elemID) },
      )
      const res = resolve([refInst, inputElem], [context])
      expect((res[0] as InstanceElement).value.test.value).toEqual('b')
    })
  })

  describe('Template Expression', () => {
    it('Should evaluate a template with reference', () => {
      const refType = new ObjectType({
        elemID: new ElemID('salto', 'simple'),
      })
      const firstRef = new InstanceElement(
        'first',
        refType,
        { from: 'Milano', to: 'Minsk' }
      )
      const secondRef = new InstanceElement(
        'second',
        refType,
        {
          into: new TemplateExpression({
            parts: [
              'Well, you made a long journey from ',
              refTo(firstRef, 'from'),
              ' to ',
              refTo(firstRef, 'to'),
              ', Rochelle Rochelle',
            ],
          }),
        }
      )
      const element = resolve([firstRef, secondRef])[1] as InstanceElement
      expect(element.value.into).toEqual(
        'Well, you made a long journey from Milano to Minsk, Rochelle Rochelle'
      )
    })
  })
})
