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
import _ from 'lodash'
import { ElemID, ObjectType, BuiltinTypes, InstanceElement, Element, ReferenceExpression, VariableExpression, TemplateExpression, ListType, Variable, isVariableExpression, isReferenceExpression, StaticFile, PrimitiveType, PrimitiveTypes } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { TestFuncImpl, getFieldsAndAnnoTypes } from '../utils'
import { resolve, UnresolvedReference, CircularReference } from '../../src/expressions'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'

const { awu } = collections.asynciterable

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
    const objType = new ObjectType({
      elemID: objElemID,
      fields: {
        value: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
    })
    const listString = new ListType(BuiltinTypes.STRING)
    const base = new ObjectType({
      elemID: baseElemID,
      fields: {
        simple: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: { anno: 'field_anno' },
        },
        obj: {
          refType: createRefToElmWithValue(objType),
        },
        arr: {
          refType: createRefToElmWithValue(listString),
        },
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
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
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
      objType,
      listString,
      simpleRefType,
    ]

    const origElements = elements.map(elem => elem.clone())

    let resolved: Element[]

    beforeAll(async () => {
      resolved = await awu(
        await resolve(elements, createInMemoryElementSource(elements))
      ).toArray()
    })

    const findResolved = <T extends Element>(
      target: Element): T => resolved.filter(
        e => _.isEqual(e.elemID, target.elemID)
      )[0] as T

    it('should not modify the origin value', () => {
      expect(origElements).toEqual(elements)
    })

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

    it('should detect reference cycles', async () => {
      const firstRef = new InstanceElement('first', simpleRefType, {})
      const secondRef = new InstanceElement('second', simpleRefType, {})
      firstRef.value.test = refTo(secondRef, 'test')
      secondRef.value.test = refTo(firstRef, 'test')
      const chained = [firstRef, secondRef]
      const inst = (await awu(await resolve(chained, createInMemoryElementSource([
        ...chained,
        simpleRefType,
        ...await getFieldsAndAnnoTypes(simpleRefType),
      ]))).toArray())[0] as InstanceElement
      expect(inst.value.test.value).toBeInstanceOf(CircularReference)
    })

    it('should fail on unresolvable', async () => {
      const firstRef = new InstanceElement('first', simpleRefType, {})
      const secondRef = new InstanceElement('second', simpleRefType, {
        test: refTo(firstRef, 'test'),
      })
      const bad = [firstRef, secondRef]
      const res = (await awu(await resolve(bad, createInMemoryElementSource([
        ...bad,
        simpleRefType,
        ...await getFieldsAndAnnoTypes(simpleRefType),
      ]))).toArray())[1] as InstanceElement
      expect(res.value.test.value).toBeInstanceOf(UnresolvedReference)
    })

    it('should fail on unresolvable roots', async () => {
      const target = new ElemID('noop', 'test')
      const firstRef = new InstanceElement(
        'first',
        simpleRefType,
        { test: new ReferenceExpression(target) },
      )
      const bad = [firstRef]
      const res = (await awu(await resolve(bad, createInMemoryElementSource([
        firstRef,
        simpleRefType,
        ...await getFieldsAndAnnoTypes(simpleRefType),
      ]))).toArray())[0] as InstanceElement
      expect(res.value.test.value).toBeInstanceOf(UnresolvedReference)
      expect(res.value.test.value.target).toEqual(target)
    })

    it('should use additional context', async () => {
      const context = new InstanceElement('second', simpleRefType, {})
      const firstRef = new InstanceElement(
        'first',
        simpleRefType,
        { test: refTo(context) },
      )
      const bad = [firstRef]
      const res = (await awu(await resolve(bad, createInMemoryElementSource([
        firstRef,
        simpleRefType,
        ...await getFieldsAndAnnoTypes(simpleRefType),
        context,
      ]))).toArray())[0] as InstanceElement
      const noContextRes = (await awu(await resolve(bad, createInMemoryElementSource([
        firstRef,
        simpleRefType,
        ...await getFieldsAndAnnoTypes(simpleRefType),
      ]))).toArray())[0] as InstanceElement
      expect(noContextRes.value.test.value).toBeInstanceOf(UnresolvedReference)
      expect(res.value.test.value).toBeInstanceOf(InstanceElement)
      expect(res.value.test.value).toEqual(context)
    })

    it('should not resolve additional context', async () => {
      const inst = new InstanceElement('second', simpleRefType, {})
      const refToInst = new ReferenceExpression(inst.elemID)
      const context = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'),
        refToInst)
      const refInst = new InstanceElement(
        'first',
        simpleRefType,
        { test: new VariableExpression(context.elemID) },
      )
      const contextElements = [context, inst]
      const res = (await awu(await resolve([refInst], createInMemoryElementSource([
        refInst,
        simpleRefType,
        ...await getFieldsAndAnnoTypes(simpleRefType),
        ...contextElements,
      ]))).toArray())
      expect(res).toHaveLength(1)
      expect((res[0] as InstanceElement).value.test.value).toEqual(inst)
    })

    it('should use elements over additional context', async () => {
      const context = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'), 'a')
      const inputElem = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'), 'b')
      const refInst = new InstanceElement(
        'first',
        simpleRefType,
        { test: new VariableExpression(context.elemID) },
      )
      const elementsToResolve = [refInst, inputElem]
      const res = (await awu(await resolve([refInst, inputElem], createInMemoryElementSource([
        ...elementsToResolve,
        simpleRefType,
        ...await getFieldsAndAnnoTypes(simpleRefType),
        context,
      ]))).toArray())
      expect((res[0] as InstanceElement).value.test.value).toEqual('b')
    })

    it('should not create copies of types', async () => {
      const primType = new PrimitiveType(
        { elemID: new ElemID('test', 'prim'), primitive: PrimitiveTypes.NUMBER }
      )
      const newObjType = new ObjectType({
        elemID: new ElemID('test', 'obj'),
        fields: { f: { refType: createRefToElmWithValue(primType) } },
        annotationRefsOrTypes: { a: primType },
      })
      const inst = new InstanceElement('test', newObjType, { f: 1 })
      const elems = [inst, newObjType, primType]
      const all = (await awu(await resolve(
        elems,
        createInMemoryElementSource(
          [
            ...elems,
            ...await getFieldsAndAnnoTypes(newObjType),
          ]
        )
      )).toArray()) as [InstanceElement, ObjectType, PrimitiveType]
      const [resInst, resObj, resPrim] = all
      expect(resObj.fields.f.refType.elemID).toBe(resPrim.elemID)
      expect(resObj.annotationRefTypes.a.elemID).toBe(resPrim.elemID)
      expect(resInst.refType.elemID).toBe(resObj.elemID)
    })
  })

  describe('Template Expression', () => {
    it('Should evaluate a template with reference', async () => {
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
      const elements = [firstRef, secondRef]
      const element = (await awu(
        await resolve(elements, createInMemoryElementSource(
          [
            firstRef,
            secondRef,
            refType,
            ...await getFieldsAndAnnoTypes(refType),
          ]
        ))
      ).toArray())[1] as InstanceElement
      expect(element.value.into).toEqual(
        'Well, you made a long journey from Milano to Minsk, Rochelle Rochelle'
      )
    })
  })
})
