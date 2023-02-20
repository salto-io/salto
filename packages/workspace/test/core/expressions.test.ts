/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, ObjectType, BuiltinTypes, InstanceElement, Element, ReferenceExpression, VariableExpression, TemplateExpression, ListType, Variable, isVariableExpression, isReferenceExpression, StaticFile, PrimitiveType, PrimitiveTypes, TypeReference, MapType, TypeElement, Field, PlaceholderObjectType, UnresolvedReference } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { TestFuncImpl, getFieldsAndAnnoTypes } from '../utils'
import { resolve, CircularReference } from '../../src/expressions'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'

const { awu } = collections.asynciterable

describe('Test Salto Expressions', () => {
  const refTo = ({ elemID }: { elemID: ElemID }, ...path: string[]): ReferenceExpression => (
    new ReferenceExpression(path.length === 0 ? elemID : elemID.createNestedID(...path))
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
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const listString = new ListType(BuiltinTypes.STRING)
    const base = new ObjectType({
      elemID: baseElemID,
      fields: {
        simple: {
          refType: BuiltinTypes.STRING,
          annotations: { anno: 'field_anno' },
        },
        obj: {
          refType: objType,
        },
        arr: {
          refType: listString,
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
          refType: BuiltinTypes.STRING,
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
      const context = new Variable(
        new ElemID(ElemID.VARIABLES_NAMESPACE, 'name'),
        refTo(inst),
      )
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
      // Should not resolve the input
      expect(refInst.value.test.value).toBeUndefined()
      expect(context.value.value).toBeUndefined()
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
        fields: { f: { refType: primType } },
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
      expect(resObj.fields.f.refType.type).toBe(resPrim)
      expect(resObj.annotationRefTypes.a.type).toBe(resPrim)
      expect(resInst.refType.type).toBe(resObj)
    })

    it('should resolve the top level element in a reference', async () => {
      const refTargetInstObj = new ObjectType({
        elemID: ElemID.fromFullName('salto.testObj'),
      })
      // We need to object types here since if we were to use the same type, it would have been
      // resolved when `instanceToResolve` would have been resolved.
      const instanceToResolveObj = new ObjectType({
        elemID: ElemID.fromFullName('salto.testObj2'),
      })
      const refTargetInst = new InstanceElement('rrr', new TypeReference(refTargetInstObj.elemID), {
        test: 'okok',
      })
      const instanceToResolve = new InstanceElement('rrr', new TypeReference(instanceToResolveObj.elemID), {
        test: refTo(refTargetInst, 'test'),
      })
      const elems = [instanceToResolve]
      const resovledElems = (await awu(await resolve(
        elems,
        createInMemoryElementSource(
          [
            refTargetInstObj, instanceToResolveObj, refTargetInst, instanceToResolve,
          ]
        ),
      )).toArray()) as [InstanceElement]
      const resolvedRef = resovledElems[0].value.test as ReferenceExpression
      const resolvedValue = resolvedRef.topLevelParent as InstanceElement
      const resolvedValueType = await resolvedValue.getType() as ObjectType
      expect(resolvedValueType).toEqual(refTargetInstObj)
    })

    it('should resolve instance with references to itself', async () => {
      const type = new ObjectType({ elemID: new ElemID('adapter', 'type') })
      const instance = new InstanceElement(
        'instance',
        type,
        {
          a: {
            ref: new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'instance', 'b')),
          },
          b: {
            ref: new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'instance', 'c')),
          },
          c: 2,
        },
      )
      const [resolvedInstance] = await resolve([instance], createInMemoryElementSource([
        instance,
        type,
        ...await getFieldsAndAnnoTypes(type),
      ])) as [InstanceElement]
      expect(resolvedInstance.value.b.ref.value).toBe(2)
      expect(resolvedInstance.value.a.ref.value.ref.value).toBe(2)
    })
  })

  describe('with field input', () => {
    let objectType: ObjectType
    let fieldType: ObjectType
    let referencedType: ObjectType
    let resolvedField: Field
    beforeEach(async () => {
      fieldType = new ObjectType({ elemID: new ElemID('salto', 'field') })
      referencedType = new ObjectType({
        elemID: new ElemID('salto', 'referenced'),
        annotations: { value: 'value' },
      })
      objectType = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        fields: {
          field: {
            refType: fieldType,
            annotations: { ref: refTo(referencedType, 'attr', 'value') },
          },
        },
        annotations: {
          ref: refTo(referencedType),
        },
      })
      const fieldToResolve = objectType.fields.field
      const resolved = await resolve(
        [fieldToResolve],
        createInMemoryElementSource(
          [fieldType, referencedType, objectType]
        )
      )
      expect(resolved).toHaveLength(1)
      expect(resolved[0]).toBeInstanceOf(Field)
      resolvedField = resolved[0] as Field
    })
    it('should resolve field type', () => {
      // We can compare to the unresolved field type because there is nothing to resolve in it
      expect(resolvedField.refType.type).toEqual(fieldType)
    })
    it('should resolve references in the field', () => {
      expect(resolvedField.annotations.ref.value).toEqual(referencedType.annotations.value)
    })
    it('should resolve the fields parent', () => {
      expect(resolvedField.parent.annotations.ref).toBeInstanceOf(ReferenceExpression)
      expect(resolvedField.parent.annotations.ref.value).toEqual(referencedType)
    })
  })

  describe('with field and type input', () => {
    let objectType: ObjectType
    let fieldType: ObjectType
    let referencedType: ObjectType
    let resolvedField: Field
    let resolvedType: ObjectType
    beforeEach(async () => {
      fieldType = new ObjectType({ elemID: new ElemID('salto', 'field') })
      referencedType = new ObjectType({
        elemID: new ElemID('salto', 'referenced'),
        annotations: { value: 'value' },
      })
      objectType = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        fields: {
          field: {
            refType: fieldType,
            annotations: { ref: refTo(referencedType, 'attr', 'value') },
          },
        },
        annotations: {
          ref: refTo(referencedType),
        },
      })
      const fieldToResolve = objectType.fields.field
      const resolved = await resolve(
        [objectType, fieldToResolve],
        createInMemoryElementSource(
          [fieldType, referencedType, objectType]
        )
      )
      expect(resolved).toHaveLength(2)
      expect(resolved[0]).toBeInstanceOf(ObjectType)
      expect(resolved[1]).toBeInstanceOf(Field)
      resolvedType = resolved[0] as ObjectType
      resolvedField = resolved[1] as Field
    })
    it('should resolve field type', () => {
      // We can compare to the unresolved field type because there is nothing to resolve in it
      expect(resolvedField.refType.type).toEqual(fieldType)
    })
    it('should resolve references in the field', () => {
      expect(resolvedField.annotations.ref.value).toEqual(referencedType.annotations.value)
    })
    it('should resolve the fields parent', () => {
      expect(resolvedField.parent.annotations.ref).toBeInstanceOf(ReferenceExpression)
      expect(resolvedField.parent.annotations.ref.value).toEqual(referencedType)
    })
    it('resolve field parent should be the resolved type', () => {
      expect(resolvedField.parent).toBe(resolvedType)
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
      const resolvedElements = await resolve(
        elements,
        createInMemoryElementSource([
          firstRef,
          secondRef,
          refType,
          ...await getFieldsAndAnnoTypes(refType),
        ]),
      )
      const element = resolvedElements[1] as InstanceElement
      expect(element.value.into.value).toEqual(
        'Well, you made a long journey from Milano to Minsk, Rochelle Rochelle'
      )
    })
    it('should detect circular reference in template expressions', async () => {
      const refType = new ObjectType({
        elemID: new ElemID('salto', 'simple'),
      })
      const firstRef = new InstanceElement(
        'first',
        refType,
        { value: new ReferenceExpression(refType.elemID.createNestedID('instance', 'second', 'template')) }
      )
      const secondRef = new InstanceElement(
        'second',
        refType,
        {
          template: new TemplateExpression({
            parts: ['template value is: ', refTo(firstRef, 'value')],
          }),
        }
      )
      const origElements = [refType, firstRef, secondRef]
      const resolvedElements = await resolve(origElements, createInMemoryElementSource())
      expect(resolvedElements).toHaveLength(origElements.length)
      const [resFirst, resSecond] = resolvedElements.slice(1) as InstanceElement[]
      expect(resFirst.value.value.value).toBeInstanceOf(CircularReference)
      expect(resSecond.value.template.parts[1].value).toBeInstanceOf(CircularReference)
    })
  })

  describe('resolve types', () => {
    describe('with missing types', () => {
      let resolvedInstance: InstanceElement
      beforeEach(async () => {
        const missingType = new ObjectType({ elemID: new ElemID('salto', 'missing') })
        const instance = new InstanceElement('inst', missingType, {})
        const resolved = await resolve([instance], createInMemoryElementSource([]))
        expect(resolved[0]).toBeInstanceOf(InstanceElement)
        resolvedInstance = resolved[0] as InstanceElement
      })
      it('should detect missing type and put a placeholder type there', () => {
        expect(resolvedInstance.refType.type).toBeInstanceOf(PlaceholderObjectType)
      })
    })
    describe('with container types', () => {
      let innerObjType: ObjectType
      let outerObjType: ObjectType
      let resolved: [ObjectType]
      let resolvedInnerType: TypeElement | undefined
      beforeEach(async () => {
        innerObjType = new ObjectType({ elemID: new ElemID('salto', 'inner') })
        outerObjType = new ObjectType({
          elemID: new ElemID('salto', 'outer'),
          fields: {
            listObj: { refType: new ListType(innerObjType) },
            mapObj: { refType: new MapType(innerObjType) },
            nestedContainers: { refType: new ListType(new MapType(new ListType(innerObjType))) },
          },
        })
        resolved = await resolve(
          [outerObjType],
          createInMemoryElementSource([innerObjType]),
        ) as typeof resolved
        resolvedInnerType = (resolved[0].fields.listObj.refType.type as ListType)?.refInnerType.type
      })
      it('should resolve field types to the same inner object type', () => {
        expect(resolved[0].fields.listObj.refType.type).toBeInstanceOf(ListType)
        expect(resolved[0].fields.mapObj.refType.type).toBeInstanceOf(MapType)
        const listInner = (resolved[0].fields.listObj.refType.type as ListType).refInnerType.type
        const mapInner = (resolved[0].fields.mapObj.refType.type as MapType).refInnerType.type
        expect(listInner).toBe(mapInner)
      })
      it('should handle multi-level containers', () => {
        const nestedFieldType = resolved[0].fields.nestedContainers.refType.type
        expect(nestedFieldType).toBeInstanceOf(ListType)
        const innerType = (nestedFieldType as ListType).refInnerType.type
        expect(innerType).toBeInstanceOf(MapType)
        const innerInnerType = (innerType as MapType).refInnerType.type
        expect(innerInnerType).toBeInstanceOf(ListType)
        const innerInnerInnerType = (innerInnerType as ListType).refInnerType.type
        expect(innerInnerInnerType).toBe(resolvedInnerType)
      })
    })
  })
})
