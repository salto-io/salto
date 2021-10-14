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
  InstanceElement, ObjectType, PrimitiveTypes, PrimitiveType, ReferenceExpression,
  ElemID, ListType, BuiltinTypes, CORE_ANNOTATIONS, MapType,
} from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { walkOnElement, WALK_NEXT_STEP, WalkOnFunc } from '../src/walk_element'

describe('Test walk_element.ts', () => {
  describe('walkOnElement', () => {
    let primType: PrimitiveType
    let listType: ListType
    let mapType: MapType
    let objType: ObjectType
    let inst: InstanceElement
    beforeEach(() => {
      primType = new PrimitiveType({
        elemID: new ElemID('test', 'prim'),
        primitive: PrimitiveTypes.NUMBER,
        annotationRefsOrTypes: { a1: BuiltinTypes.STRING },
        annotations: { a1: 'asd' },
      })
      listType = new ListType(primType)
      mapType = new MapType(primType)
      objType = new ObjectType({
        elemID: new ElemID('test', 'test'),
        fields: {
          f1: { refType: BuiltinTypes.STRING },
          f2: {
            refType: listType,
            annotations: {
              a1: 'foo',
              [CORE_ANNOTATIONS.DEPENDS_ON]: [
                { reference: new ReferenceExpression(primType.elemID) },
              ],
            },
          },
          f3: {
            refType: mapType,
            annotations: {
              a2: 'foo',
              [CORE_ANNOTATIONS.DEPENDS_ON]: [
                { reference: new ReferenceExpression(primType.elemID) },
              ],
            },
          },
          f4: {
            refType: BuiltinTypes.STRING,
          },
        },
        annotationRefsOrTypes: { a2: BuiltinTypes.STRING },
        annotations: { a2: 1 },
      })
      inst = new InstanceElement(
        'test',
        objType,
        { f1: 'a', f2: [1, 2, 3], f3: false },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: ['me'],
          [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl',
        },
      )
    })
    describe('with ObjectType', () => {
      it('should walk on all the nodes in DFS pre order', async () => {
        const paths: string[] = []
        const func = mockFunction<WalkOnFunc>()
          .mockImplementation(({ path }) => {
            paths.push(path.getFullName())
            return WALK_NEXT_STEP.RECURSE
          })
        walkOnElement({ element: objType, func })
        expect(paths).toEqual([
          'test.test',
          'test.test.attr',
          'test.test.attr.a2',
          'test.test.field',
          'test.test.field.f1',
          'test.test.field.f2',
          'test.test.field.f2.a1',
          'test.test.field.f2._depends_on',
          'test.test.field.f2._depends_on.0',
          'test.test.field.f2._depends_on.0.reference',
          'test.test.field.f3',
          'test.test.field.f3.a2',
          'test.test.field.f3._depends_on',
          'test.test.field.f3._depends_on.0',
          'test.test.field.f3._depends_on.0.reference',
          'test.test.field.f4',
        ])
      })
      it('should stop iteration when EXIT is returned', () => {
        const paths: string[] = []
        const func = mockFunction<WalkOnFunc>()
          .mockImplementation(({ path }) => {
            paths.push(path.getFullName())
            if (path.getFullName() === 'test.test.field.f1') {
              return WALK_NEXT_STEP.EXIT
            }
            return WALK_NEXT_STEP.RECURSE
          })
        walkOnElement({ element: objType, func })
        expect(paths).toEqual([
          'test.test',
          'test.test.attr',
          'test.test.attr.a2',
          'test.test.field',
          'test.test.field.f1',
        ])
      })
      it('should walk only on top level', () => {
        const paths: string[] = []
        const func = mockFunction<WalkOnFunc>()
          .mockImplementation(({ path }) => {
            paths.push(path.getFullName())
            return WALK_NEXT_STEP.SKIP
          })
        walkOnElement({ element: objType, func })
        expect(paths).toEqual([objType.elemID.getFullName()])
      })
    })
    describe('with InstanceElement', () => {
      it('should walk on all the nodes in DFS pre order', () => {
        const paths: string[] = []
        const func = mockFunction<WalkOnFunc>()
          .mockImplementation(({ path }) => {
            paths.push(path.getFullName())
            return WALK_NEXT_STEP.RECURSE
          })
        walkOnElement({ element: inst, func })
        expect(paths).toEqual([
          'test.test.instance.test',
          'test.test.instance.test._parent',
          'test.test.instance.test._parent.0',
          'test.test.instance.test._service_url',
          'test.test.instance.test.f1',
          'test.test.instance.test.f2',
          'test.test.instance.test.f2.0',
          'test.test.instance.test.f2.1',
          'test.test.instance.test.f2.2',
          'test.test.instance.test.f3',
        ])
      })
      it('should walk only on top level', async () => {
        const paths: string[] = []
        const func = mockFunction<WalkOnFunc>()
          .mockImplementation(({ path }) => {
            paths.push(path.getFullName())
            return WALK_NEXT_STEP.SKIP
          })
        walkOnElement({ element: inst, func })
        expect(paths).toEqual([inst.elemID.getFullName()])
      })
    })
  })
})
