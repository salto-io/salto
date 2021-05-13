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
import {
  InstanceElement, ObjectType, PrimitiveTypes, PrimitiveType, ReferenceExpression, ElemID, ListType,
  BuiltinTypes, CORE_ANNOTATIONS, MapType,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies, FlatDetailedDependency, DetailedDependency } from '../src/dependencies'

describe('dependencies', () => {
  const mockStrType = new PrimitiveType({
    elemID: new ElemID('mockAdapter', 'str'),
    primitive: PrimitiveTypes.STRING,
    annotations: { testAnno: 'TEST ANNO TYPE' },
    path: ['here', 'we', 'go'],
  })
  const mockElem = new ElemID('mockAdapter', 'test')
  const mockType = new ObjectType({
    elemID: mockElem,
    annotationRefsOrTypes: {
      testAnno: mockStrType,
    },
    annotations: {
      testAnno: 'TEST ANNO',
    },
    fields: {
      ref: { refType: BuiltinTypes.STRING },
      str: { refType: BuiltinTypes.STRING, annotations: { testAnno: 'TEST FIELD ANNO' } },
      file: { refType: BuiltinTypes.STRING },
      bool: { refType: BuiltinTypes.BOOLEAN },
      num: { refType: BuiltinTypes.NUMBER },
      numArray: { refType: new ListType(BuiltinTypes.NUMBER) },
      strArray: { refType: new ListType(BuiltinTypes.STRING) },
      numMap: { refType: new MapType(BuiltinTypes.NUMBER) },
      strMap: { refType: new MapType(BuiltinTypes.STRING) },
      obj: {
        refType: new ListType(new ObjectType({
          elemID: mockElem,
          fields: {
            field: { refType: BuiltinTypes.STRING },
            otherField: {
              refType: BuiltinTypes.STRING,
            },
            value: { refType: BuiltinTypes.STRING },
            mapOfStringList: { refType: new MapType(new ListType(BuiltinTypes.STRING)) },
            innerObj: {

              refType: new ObjectType({
                elemID: mockElem,
                fields: {
                  name: { refType: BuiltinTypes.STRING },
                  listOfNames: { refType: new ListType(BuiltinTypes.STRING) },
                  magical: {
                    refType: new ObjectType({
                      elemID: mockElem,
                      fields: {
                        deepNumber: { refType: BuiltinTypes.NUMBER },
                        deepName: { refType: BuiltinTypes.STRING },
                      },
                    }),
                  },
                },
              }),
            },
          },
        })),
      },
    },
    path: ['this', 'is', 'happening'],
  })

  describe('extendGeneratedDependencies', () => {
    it('should create the _generated_dependencies annotation if it does not exist', () => {
      const type = new ObjectType({
        elemID: mockElem,
        annotationRefsOrTypes: {
          testAnno: mockStrType,
        },
        annotations: {
          testAnno: 'TEST ANNO',
        },
        fields: {
          f1: { refType: BuiltinTypes.STRING },
        },
      })
      const inst = new InstanceElement('something', mockType, {})

      const reference = new ReferenceExpression(new ElemID('adapter', 'type123'))
      const flatRefs: FlatDetailedDependency[] = [{ reference, direction: 'input' }]
      const structuredRefs = [{ reference, occurrences: [{ direction: 'input' }] }]

      extendGeneratedDependencies(type, flatRefs)
      expect(type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(structuredRefs)

      extendGeneratedDependencies(inst, flatRefs)
      expect(inst.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(inst.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(structuredRefs)

      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
      extendGeneratedDependencies(type.fields.f1, flatRefs)
      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(
        structuredRefs
      )
    })
    it('should extend the _generated_dependencies annotation if it already exists', () => {
      const oldRefs = [{ reference: new ReferenceExpression(new ElemID('adapter', 'type123')) }]
      const type = new ObjectType({
        elemID: mockElem,
        annotationRefsOrTypes: {
          testAnno: mockStrType,
        },
        annotations: {
          testAnno: 'TEST ANNO',
          [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [...oldRefs],
        },
        fields: {
          f1: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [...oldRefs] },
          },
        },
      })
      const inst = new InstanceElement(
        'something',
        mockType,
        {},
        undefined,
        { [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [...oldRefs] },
      )

      const newRefs: FlatDetailedDependency[] = [
        { reference: new ReferenceExpression(new ElemID('adapter', 'type456')) },
      ]

      extendGeneratedDependencies(type, newRefs)
      expect(type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(
        [...oldRefs, ...newRefs]
      )

      extendGeneratedDependencies(inst, newRefs)
      expect(inst.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(inst.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(
        [...oldRefs, ...newRefs]
      )

      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      extendGeneratedDependencies(type.fields.f1, newRefs)
      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(
        [...oldRefs, ...newRefs]
      )
    })
    it('should do nothing if no new annotations are added', () => {
      const oldRefs = [{ reference: new ReferenceExpression(new ElemID('adapter', 'type123')) }]
      const type = new ObjectType({
        elemID: mockElem,
        annotationRefsOrTypes: {
          testAnno: mockStrType,
        },
        annotations: {
          testAnno: 'TEST ANNO',
          [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [...oldRefs],
        },
        fields: {
          f1: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [...oldRefs] },
          },
        },
      })
      const inst = new InstanceElement(
        'something',
        mockType,
        {},
        undefined,
        { [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [...oldRefs] },
      )

      extendGeneratedDependencies(type, [])
      expect(type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(oldRefs)

      extendGeneratedDependencies(inst, [])
      expect(inst.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(inst.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(oldRefs)

      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      extendGeneratedDependencies(type.fields.f1, [])
      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
      expect(type.fields.f1.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual(oldRefs)
    })
    describe('annotation structure', () => {
      let type: ObjectType
      beforeAll(() => {
        type = new ObjectType({
          elemID: mockElem,
          annotations: {
            [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
              { reference: new ReferenceExpression(new ElemID('adapter', 'type123')) },
              { reference: new ReferenceExpression(new ElemID('adapter', 'type456')) },
              {
                reference: new ReferenceExpression(new ElemID('adapter', 'type789')),
                occurrences: [
                  // intentionally not sorted correctly
                  { direction: 'output' },
                  { direction: 'input' },
                ],
              },
            ],
          },
        })

        extendGeneratedDependencies(type, [
          {
            reference: new ReferenceExpression(new ElemID('adapter', 'type456')),
            location: new ReferenceExpression(mockElem.createNestedID('attr', 'def1')),
            direction: 'output',
          },
          {
            reference: new ReferenceExpression(new ElemID('adapter', 'type456')),
            location: new ReferenceExpression(mockElem.createNestedID('attr', 'def2')),
            direction: 'input',
          },
          {
            reference: new ReferenceExpression(new ElemID('adapter', 'type456', 'instance', 'inst456')),
            location: new ReferenceExpression(mockElem.createNestedID('attr', 'def2')),
            direction: 'input',
          },
          {
            reference: new ReferenceExpression(new ElemID('adapter', 'type456', 'instance', 'inst456')),
            location: new ReferenceExpression(mockElem.createNestedID('attr', 'def2')),
            direction: 'output',
          },
          {
            reference: new ReferenceExpression(new ElemID('adapter', 'type456', 'instance', 'inst456')),
          },
          { reference: new ReferenceExpression(new ElemID('adapter', 'type123')) },
          {
            reference: new ReferenceExpression(new ElemID('adapter', 'type456')),
            location: new ReferenceExpression(mockElem.createNestedID('attr', 'def3')),
          },
          {
            reference: new ReferenceExpression(new ElemID('adapter', 'type456')),
            location: new ReferenceExpression(mockElem.createNestedID('attr', 'def2')),
          },
          { reference: new ReferenceExpression(new ElemID('adapter', 'aaa')) },
        ])
      })

      const findRefDeps = (id: ElemID): DetailedDependency => (
        type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].find(
          (e: DetailedDependency) => e.reference.elemID.isEqual(id)
        )
      )
      const getOccurrences = (
        dep: DetailedDependency
      ): { direction?: string; location?: string}[] | undefined => (
        dep.occurrences?.map(oc => ({ ...oc, location: oc.location?.elemID.getFullName() }))
      )

      it('should have one entry for each reference, sorted by the referenced elem id', () => {
        expect(type.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(
          (e: DetailedDependency) => e.reference.elemID.getFullName()
        )).toEqual([
          'adapter.aaa',
          'adapter.type123',
          'adapter.type456',
          'adapter.type456.instance.inst456',
          'adapter.type789',
        ])
      })
      it('should have an empty list of occurrences when no additional details are provided', () => {
        const type123Refs = findRefDeps(new ElemID('adapter', 'type123'))
        expect(type123Refs).toBeDefined()
        expect(type123Refs.occurrences).toBeUndefined()
        const aaaRefs = findRefDeps(new ElemID('adapter', 'aaa'))
        expect(aaaRefs).toBeDefined()
        expect(aaaRefs.occurrences).toBeUndefined()
      })
      it('should keep the existing annotation value when no new details are addded', () => {
        const type789Refs = findRefDeps(new ElemID('adapter', 'type789'))
        expect(type789Refs).toBeDefined()
        expect(type789Refs.occurrences).toBeDefined()
        expect(getOccurrences(type789Refs)).toEqual([
          { direction: 'output' },
          { direction: 'input' },
        ])
      })
      it('should omit less-specific occurrences when more detailed ones are provided', () => {
        const type456Refs = findRefDeps(new ElemID('adapter', 'type456'))
        expect(type456Refs).toBeDefined()
        expect(type456Refs.occurrences).toBeDefined()
        expect(getOccurrences(type456Refs)).toEqual([
          { location: mockElem.createNestedID('attr', 'def3').getFullName() },
          { location: mockElem.createNestedID('attr', 'def2').getFullName(), direction: 'input' },
          { location: mockElem.createNestedID('attr', 'def1').getFullName(), direction: 'output' },
        ])

        const inst456Refs = findRefDeps(new ElemID('adapter', 'type456', 'instance', 'inst456'))
        expect(inst456Refs).toBeDefined()
        expect(inst456Refs.occurrences).toBeDefined()
        expect(getOccurrences(inst456Refs)).toEqual([
          { location: mockElem.createNestedID('attr', 'def2').getFullName(), direction: 'input' },
          { location: mockElem.createNestedID('attr', 'def2').getFullName(), direction: 'output' },
        ])
      })
    })
  })
})
