import _ from 'lodash'
import {
  ElemID, ObjectType, Field, BuiltinTypes, InstanceElement, Element,
  ReferenceExpression, TemplateExpression,
} from 'adapter-api'
import { resolve, UnresolvedReference } from '../../src/core/expressions'

describe('Test Salto Expressions', () => {
  describe('Reference Expression', () => {
    const baseElemID = new ElemID('salto', 'base')
    const objElemID = new ElemID('salto', 'obj')
    const base = new ObjectType({
      elemID: baseElemID,
      fields: {
        simple: new Field(baseElemID, 'simple', BuiltinTypes.STRING, { anno: 'field_anno' }),
        obj: new Field(baseElemID, 'simple', new ObjectType({
          elemID: objElemID,
          fields: {
            value: new Field(objElemID, 'objField', BuiltinTypes.STRING),
          },
        })),
        arr: new Field(baseElemID, 'arr', BuiltinTypes.STRING, {}, true),
      },
      annotations: {
        anno: 'base_anno',
      },
    })

    const baseInstID = new ElemID('salto', 'inst')
    const baseInst = new InstanceElement(baseInstID, base, {
      simple: 'simple',
      obj: { value: 'nested' },
      arr: ['A', 'B'],
    })

    const simpleRefTypeID = new ElemID('salto', 'simple_ref_type')
    const simpleRefType = new ObjectType({
      elemID: simpleRefTypeID,
    })
    const noRefInst = new InstanceElement(new ElemID('salto', 'noref'), simpleRefType, {
      test: `${baseInstID.getFullName()}.simple`,
    })

    const simpleRefInst = new InstanceElement(new ElemID('salto', 'simpleref'), simpleRefType, {
      test: new ReferenceExpression({ traversalParts: [baseInstID.getFullName(), 'simple'] }),
    })

    const nestedRefInst = new InstanceElement(new ElemID('salto', 'nesetedref'), simpleRefType, {
      test: new ReferenceExpression({ traversalParts: [baseInstID.getFullName(), 'obj', 'value'] }),
    })

    const arrayRefInst = new InstanceElement(new ElemID('salto', 'arrayref'), simpleRefType, {
      test0: new ReferenceExpression({ traversalParts: [baseInstID.getFullName(), 'arr', 0] }),
      test1: new ReferenceExpression({ traversalParts: [baseInstID.getFullName(), 'arr', 1] }),
    })

    const annoRefInst = new InstanceElement(new ElemID('salto', 'annoref'), simpleRefType, {
      test: new ReferenceExpression({ traversalParts: [baseElemID.getFullName(), 'anno'] }),
    })

    const fieldAnnoRefInst = new InstanceElement(new ElemID('salto', 'fieldref'), simpleRefType, {
      test: new ReferenceExpression({ traversalParts: [baseElemID.getFullName(), 'simple', 'anno'] }),
    })

    const chainedRefInst = new InstanceElement(
      new ElemID('salto', 'chainedref'), simpleRefType, {
        test: new ReferenceExpression({ traversalParts: [simpleRefInst.elemID.getFullName(), 'test'] }),
      }
    )

    const noPathInst = new InstanceElement(
      new ElemID('salto', 'nopath'), simpleRefType, {
        test: new ReferenceExpression({ traversalParts: [baseInst.elemID.getFullName()] }),
      }
    )

    const objectRefID = new ElemID('salto', 'objref')
    const objectRef = new ObjectType({
      elemID: objectRefID,
      fields: {
        ref: new Field(baseElemID, 'simple', BuiltinTypes.STRING, {
          anno: new ReferenceExpression({ traversalParts: [baseElemID.getFullName(), 'anno'] }),
        }),
      },
      annotations: {
        anno: new ReferenceExpression({ traversalParts: [baseElemID.getFullName(), 'anno'] }),
      },
    })

    const elements = [
      base,
      baseInst,
      noRefInst,
      simpleRefInst,
      nestedRefInst,
      arrayRefInst,
      annoRefInst,
      fieldAnnoRefInst,
      chainedRefInst,
      noPathInst,
      objectRef,
    ]

    const resolved = elements.map(e => resolve(e, elements))

    const findResolved = <T extends Element>(
      target: Element): T => resolved.filter(
        e => _.isEqual(e.elemID, target.elemID)
      )[0] as T

    it('should not modify simple values', () => {
      const element = findResolved<InstanceElement>(noRefInst)
      expect(element.value.test).toEqual(`${baseInstID.getFullName()}.simple`)
    })

    it('should resolve simple references', () => {
      const element = findResolved<InstanceElement>(simpleRefInst)
      expect(element.value.test).toEqual('simple')
    })

    it('should resolve nested references', () => {
      const element = findResolved<InstanceElement>(nestedRefInst)
      expect(element.value.test).toEqual('nested')
    })

    it('should resolve array references', () => {
      const element = findResolved<InstanceElement>(arrayRefInst)
      expect(element.value.test0).toEqual('A')
      expect(element.value.test1).toEqual('B')
    })

    it('should resolve annotations references', () => {
      const element = findResolved<InstanceElement>(annoRefInst)
      expect(element.value.test).toEqual('base_anno')
    })

    it('should resolve field annotation values references', () => {
      const element = findResolved<InstanceElement>(fieldAnnoRefInst)
      expect(element.value.test).toEqual('field_anno')
    })

    it('should resolve references with no path', () => {
      const element = findResolved<InstanceElement>(noPathInst)
      expect(element.value.test).toEqual(baseInst.value)
    })

    it('should resolve chained references', () => {
      const element = findResolved<InstanceElement>(chainedRefInst)
      expect(element.value.test).toEqual('simple')
    })

    it('should detect reference cycles', () => {
      const firstRefID = new ElemID('salto', 'first')
      const secondRefID = new ElemID('salto', 'second')
      const firstRef = new InstanceElement(
        firstRefID,
        simpleRefType,
        { test: new ReferenceExpression({ traversalParts: [secondRefID.getFullName(), 'test'] }) },
      )
      const secondRef = new InstanceElement(
        secondRefID,
        simpleRefType,
        { test: new ReferenceExpression({ traversalParts: [firstRefID.getFullName(), 'test'] }) },
      )
      const chained = [firstRef, secondRef]
      expect(() => chained.map(e => resolve(e, chained))).toThrow()
    })

    it('should fail on unresolvable', () => {
      const firstRefID = new ElemID('salto', 'first')
      const secondRefID = new ElemID('salto', 'second')
      const firstRef = new InstanceElement(
        firstRefID,
        simpleRefType,
        {}
      )
      const secondRef = new InstanceElement(
        secondRefID,
        simpleRefType,
        { test: new ReferenceExpression({ traversalParts: [firstRefID.getFullName(), 'test'] }) },
      )
      const bad = [firstRef, secondRef]
      const res = resolve(secondRef, bad) as InstanceElement
      expect(res.value.test).toBeInstanceOf(UnresolvedReference)
    })

    it('should fail on unresolvable roots', () => {
      const firstRefID = new ElemID('salto', 'first')
      const firstRef = new InstanceElement(
        firstRefID,
        simpleRefType,
        { test: new ReferenceExpression({ traversalParts: ['noop', 'test'] }) },
      )
      const bad = [firstRef]
      const res = resolve(firstRef, bad) as InstanceElement
      expect(res.value.test).toBeInstanceOf(UnresolvedReference)
    })
  })

  describe('Template Expression', () => {
    it('Should evaluate a template with reference', () => {
      const refType = new ObjectType({
        elemID: new ElemID('salto', 'simple'),
      })
      const firstRefID = new ElemID('salto', 'first')
      const firstRef = new InstanceElement(
        firstRefID,
        refType,
        { from: 'Milano', to: 'Minsk' }
      )
      const secondRef = new InstanceElement(
        new ElemID('salto', 'second'),
        refType,
        {
          into: new TemplateExpression({
            parts: [
              'Well, you made a long journey from ',
              new ReferenceExpression({ traversalParts: [firstRefID.getFullName(), 'from'] }),
              ' to ',
              new ReferenceExpression({ traversalParts: [firstRefID.getFullName(), 'to'] }),
              ', Rochelle Rochelle',
            ],
          }),
        }
      )
      const element = resolve(secondRef, [firstRef, secondRef]) as InstanceElement
      expect(element.value.into).toEqual(
        'Well, you made a long journey from Milano to Minsk, Rochelle Rochelle'
      )
    })
  })
})
