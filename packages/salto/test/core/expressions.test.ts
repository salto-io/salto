import _ from 'lodash'
import {
  ElemID, ObjectType, Field, BuiltinTypes, InstanceElement, Element,
  ReferenceExpression, TemplateExpression,
} from 'adapter-api'
import { resolve, UnresolvedReference } from '../../src/core/expressions'

describe('Test Salto Expressions', () => {
  const refTo = ({ elemID }: { elemID: ElemID }, ...path: string[]): ReferenceExpression => (
    new ReferenceExpression(
      elemID.createNestedID(...path)
    )
  )

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

    const baseInst = new InstanceElement('inst', base, {
      simple: 'simple',
      obj: { value: 'nested' },
      arr: ['A', 'B'],
    })

    const simpleRefType = new ObjectType({
      elemID: new ElemID('salto', 'simple_ref_type'),
    })
    const noRefInst = new InstanceElement('noref', simpleRefType, {
      test: `${baseInst.elemID.getFullName()}.simple`,
    })

    const simpleRefInst = new InstanceElement('simpleref', simpleRefType, {
      test: refTo(baseInst, 'simple'),
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
        ref: new Field(baseElemID, 'simple', BuiltinTypes.STRING, {
          anno: refTo(base, 'attr', 'anno'),
        }),
      },
      annotations: {
        anno: refTo(base, 'attr', 'anno'),
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
      expect(element.value.test).toEqual(`${baseInst.elemID.getFullName()}.simple`)
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
      const firstRef = new InstanceElement('first', simpleRefType, {})
      const secondRef = new InstanceElement('second', simpleRefType, {})
      firstRef.value.test = refTo(secondRef, 'test')
      secondRef.value.test = refTo(firstRef, 'test')
      const chained = [firstRef, secondRef]
      expect(() => chained.map(e => resolve(e, chained))).toThrow()
    })

    it('should fail on unresolvable', () => {
      const firstRef = new InstanceElement('first', simpleRefType, {})
      const secondRef = new InstanceElement('second', simpleRefType, {
        test: refTo(firstRef, 'test'),
      })
      const bad = [firstRef, secondRef]
      const res = resolve(secondRef, bad) as InstanceElement
      expect(res.value.test).toBeInstanceOf(UnresolvedReference)
    })

    it('should fail on unresolvable roots', () => {
      const firstRef = new InstanceElement(
        'first',
        simpleRefType,
        { test: new ReferenceExpression(new ElemID('noop', 'test')) },
      )
      const bad = [firstRef]
      const res = resolve(firstRef, bad) as InstanceElement
      expect(res.value.test).toBeInstanceOf(UnresolvedReference)
      expect(res.value.test.ref).toEqual('noop.test')
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
      const element = resolve(secondRef, [firstRef, secondRef]) as InstanceElement
      expect(element.value.into).toEqual(
        'Well, you made a long journey from Milano to Minsk, Rochelle Rochelle'
      )
    })
  })
})
