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
import wu from 'wu'
import { DiffGraph, DataNodeMap, DiffNode } from '@salto-io/dag'
import { ChangeDataType, Change, ObjectType, InstanceElement, ElemID, ReferenceExpression, Field, BuiltinTypes, PrimitiveType, PrimitiveTypes, INSTANCE_ANNOTATIONS } from '@salto-io/adapter-api'
import {
  addNodeDependencies, addAfterRemoveDependency, addFieldToObjectDependency, addTypeDependency,
  addReferencesDependency,
} from '../../../src/core/plan/dependency'
import { DependencyChange, ChangeId } from '../../../src/core/plan/dependency/common'
import { getAllElements } from '../../common/elements'

describe('addNodeDependencies', () => {
  const diffNode = (
    originalId: DiffNode<ChangeDataType>['originalId'],
    action: 'add' | 'remove',
    data: ChangeDataType,
  ): DiffNode<ChangeDataType> => (
    action === 'add'
      ? { action, originalId, data: { after: data } }
      : { action, originalId, data: { before: data } }
  )

  let inputGraph: DiffGraph<ChangeDataType>
  let outputGraph: DiffGraph<ChangeDataType>
  let mockChanger: jest.Mock
  beforeEach(() => {
    const [testElem] = getAllElements()

    mockChanger = jest.fn()
    inputGraph = new DataNodeMap<DiffNode<ChangeDataType>>()
    inputGraph.addNode(1, [], diffNode(1, 'remove', testElem))
    inputGraph.addNode(2, [1], diffNode(1, 'add', testElem))
    inputGraph.addNode(3, [1], diffNode(3, 'add', testElem))
  })

  describe('when there are no dependecy changes', () => {
    beforeEach(async () => {
      mockChanger.mockResolvedValue([])
      outputGraph = await addNodeDependencies([mockChanger])(inputGraph)
    })
    it('should not change the graph', () => {
      expect(outputGraph).toEqual(inputGraph)
    })
  })

  describe('when dependecy changer returns add change', () => {
    beforeEach(async () => {
      mockChanger.mockResolvedValue([
        { action: 'add', dependency: { source: 1, target: 2 } },
      ] as DependencyChange[])
      outputGraph = await addNodeDependencies([mockChanger])(inputGraph)
    })
    it('should keep the pre-existing dependencies', () => {
      expect(outputGraph.get(2)).toEqual(inputGraph.get(2))
      expect(outputGraph.get(3)).toEqual(inputGraph.get(3))
    })
    it('should add the new dependecies', () => {
      expect(outputGraph.get(1)).toContain(2)
    })
  })

  describe('when dependecy changer returns remove changes', () => {
    beforeEach(async () => {
      mockChanger.mockResolvedValue([
        { action: 'remove', dependency: { source: 2, target: 1 } },
      ] as DependencyChange[])
      outputGraph = await addNodeDependencies([mockChanger])(inputGraph)
    })
    it('should keep the pre-existing dependecies that were not removed', () => {
      expect(outputGraph.get(3)).toEqual(inputGraph.get(3))
    })
    it('should retain empty sets of dependecies', () => {
      expect(outputGraph.get(2)).toBeDefined()
    })
    it('should remove the dependecy in the change', () => {
      expect(outputGraph.get(2)).not.toContain(1)
    })
  })

  describe('with multiple changers', () => {
    let mockChanger2: jest.Mock
    beforeEach(() => {
      mockChanger2 = jest.fn()
    })
    describe('when changers return non conflicting changes', () => {
      beforeEach(async () => {
        mockChanger.mockResolvedValue([
          { action: 'add', dependency: { source: 1, target: 2 } },
        ] as DependencyChange[])
        mockChanger2.mockResolvedValue([
          { action: 'add', dependency: { source: 1, target: 3 } },
        ] as DependencyChange[])
        outputGraph = await addNodeDependencies([mockChanger, mockChanger2])(inputGraph)
      })
      it('should apply all changes', () => {
        expect(outputGraph.get(1)).toEqual(new Set([2, 3]))
      })
    })
    describe('when changers return conflicting changes', () => {
      beforeEach(async () => {
        mockChanger.mockResolvedValue([
          { action: 'add', dependency: { source: 1, target: 2 } },
        ] as DependencyChange[])
        mockChanger2.mockResolvedValue([
          { action: 'remove', dependency: { source: 1, target: 2 } },
        ] as DependencyChange[])
        outputGraph = await addNodeDependencies([mockChanger, mockChanger2])(inputGraph)
      })
      it('should apply the second changer over the first changer', () => {
        expect(outputGraph).toEqual(inputGraph)
      })
    })
  })
})

describe('dependecy changers', () => {
  const toChange = (action: 'add' | 'remove', data: ChangeDataType): Change => (
    action === 'add'
      ? { action, data: { after: data } }
      : { action, data: { before: data } }
  )
  let saltoOffice: ObjectType
  let saltoEmployee: ObjectType
  let saltoEmployeeInstance: InstanceElement
  let dependencyChanges: DependencyChange[]
  beforeEach(() => {
    [,, saltoOffice, saltoEmployee, saltoEmployeeInstance] = getAllElements()
  })

  describe('addAfterRemoveDependency', () => {
    describe('when the same element is removed and added', () => {
      beforeEach(async () => {
        const inputChanges = new Map([
          [0, toChange('remove', saltoEmployee)],
          [1, toChange('add', saltoEmployee)],
        ])
        dependencyChanges = [...await addAfterRemoveDependency(inputChanges, new Map())]
      })
      it('should add dependency between add and remove changes', () => {
        expect(dependencyChanges).toHaveLength(1)
        expect(dependencyChanges[0].action).toEqual('add')
        expect(dependencyChanges[0].dependency.source).toEqual(1)
        expect(dependencyChanges[0].dependency.target).toEqual(0)
      })
    })
    describe('when different elements are added and removed', () => {
      beforeEach(async () => {
        const inputChanges = new Map([
          [0, toChange('remove', saltoEmployee)],
          [1, toChange('add', saltoEmployeeInstance)],
        ])
        dependencyChanges = [...await addAfterRemoveDependency(inputChanges, new Map())]
      })
      it('should not add dependencies', () => {
        expect(dependencyChanges).toHaveLength(0)
      })
    })
  })

  describe('addFieldToObjectDependency', () => {
    const fieldChanges = (
      action: 'add' | 'remove',
      obj: ObjectType,
      idOffset = 1,
    ): [ChangeId, Change][] => ([
      ...wu.enumerate(
        Object.values(obj.fields).map(field => toChange(action, field))
      ).map(([change, id]) => [id + idOffset, change] as [ChangeId, Change]),
    ])

    const objectAndFieldChanges = (
      action: 'add' | 'remove',
      obj: ObjectType,
    ): [ChangeId, Change][] => ([
      [0, toChange(action, obj)],
      ...fieldChanges(action, obj),
    ])

    describe('when element and fields are added', () => {
      beforeEach(async () => {
        const inputChanges = new Map(objectAndFieldChanges('add', saltoEmployee))
        dependencyChanges = [...await addFieldToObjectDependency(inputChanges, new Map())]
      })
      it('should add depenency from each field to the element', () => {
        expect(dependencyChanges).toHaveLength(Object.values(saltoEmployee.fields).length)
        expect(dependencyChanges.every(change => change.action === 'add')).toBeTruthy()
        expect(dependencyChanges.every(change => change.dependency.target === 0)).toBeTruthy()
      })
    })

    describe('when element and fields are removed', () => {
      beforeEach(async () => {
        const inputChanges = new Map(objectAndFieldChanges('remove', saltoEmployee))
        dependencyChanges = [...await addFieldToObjectDependency(inputChanges, new Map())]
      })
      it('should add depenency from each field to element removal', () => {
        expect(dependencyChanges).toHaveLength(Object.values(saltoEmployee.fields).length)
        expect(dependencyChanges.every(change => change.action === 'add')).toBeTruthy()
        expect(dependencyChanges.every(change => change.dependency.target === 0)).toBeTruthy()
      })
    })

    describe('when element is not changed', () => {
      beforeEach(async () => {
        const inputChanges = new Map(fieldChanges('add', saltoEmployee))
        dependencyChanges = [...await addFieldToObjectDependency(inputChanges, new Map())]
      })
      it('should not add dependecies', () => {
        expect(dependencyChanges).toHaveLength(0)
      })
    })
  })

  describe('addTypeDependency', () => {
    describe('when instance and type are added', () => {
      beforeEach(async () => {
        const inputChanges = new Map([
          [0, toChange('add', saltoEmployee)],
          [1, toChange('add', saltoEmployeeInstance)],
        ])
        dependencyChanges = [...await addTypeDependency(inputChanges, new Map())]
      })
      it('should add dependency from instance to type', () => {
        expect(dependencyChanges).toHaveLength(1)
        expect(dependencyChanges[0].action).toEqual('add')
        expect(dependencyChanges[0].dependency.source).toEqual(1)
        expect(dependencyChanges[0].dependency.target).toEqual(0)
      })
    })
    describe('when field and type are added', () => {
      beforeEach(async () => {
        const inputChanges = new Map([
          [0, toChange('add', saltoEmployee.fields.office)],
          [1, toChange('add', saltoOffice)],
        ])
        dependencyChanges = [...await addTypeDependency(inputChanges, new Map())]
      })
      it('should add dependency from field to type', () => {
        expect(dependencyChanges).toHaveLength(1)
        expect(dependencyChanges[0].action).toEqual('add')
        expect(dependencyChanges[0].dependency.source).toEqual(0)
        expect(dependencyChanges[0].dependency.target).toEqual(1)
      })
    })
  })

  describe('addReferecesDependency', () => {
    const testTypeId = new ElemID('test', 'type')
    let testAnnoType: PrimitiveType
    let testType: ObjectType
    let testParent: InstanceElement
    let testInstance: InstanceElement

    beforeEach(() => {
      testAnnoType = new PrimitiveType({
        elemID: new ElemID('test', 'anno'),
        primitive: PrimitiveTypes.STRING,
      })
      testType = new ObjectType({
        elemID: testTypeId,
        fields: { ref: new Field(testTypeId, 'ref', BuiltinTypes.STRING) },
        annotations: { annoRef: new ReferenceExpression(testAnnoType.elemID) },
        annotationTypes: { annoRef: testAnnoType },
      })
      testParent = new InstanceElement(
        'parent',
        testType,
        {},
      )
      testInstance = new InstanceElement(
        'test',
        testType,
        { ref: new ReferenceExpression(testTypeId) },
        undefined,
        { [INSTANCE_ANNOTATIONS.PARENT]: [new ReferenceExpression(testParent.elemID)] }
      )
    })

    describe('when reference and target are added', () => {
      beforeEach(async () => {
        const inputChanges = new Map([
          [0, toChange('add', testType)],
          [1, toChange('add', testInstance)],
          [2, toChange('add', testAnnoType)],
          [3, toChange('add', testParent)],
        ])
        dependencyChanges = [...await addReferencesDependency(inputChanges, new Map())]
      })
      it('should add dependency from value reference to target', () => {
        expect(dependencyChanges).toContainEqual(
          { action: 'add', dependency: { source: 1, target: 0 } }
        )
      })
      it('should add dependency from annotation reference to target', () => {
        expect(dependencyChanges).toContainEqual(
          { action: 'add', dependency: { source: 0, target: 2 } }
        )
      })
      it('should add dependency from instance to parent', () => {
        expect(dependencyChanges).toContainEqual(
          { action: 'add', dependency: { source: 1, target: 3 } }
        )
      })
    })
    describe('when reference and target are removed', () => {
      beforeEach(async () => {
        const inputChanges = new Map([
          [0, toChange('remove', testType)],
          [1, toChange('remove', testInstance)],
          [2, toChange('remove', testParent)],
        ])
        dependencyChanges = [...await addReferencesDependency(inputChanges, new Map())]
      })
      it('should add dependency from target to reference', () => {
        expect(dependencyChanges).toContainEqual(
          { action: 'add', dependency: { source: 0, target: 1 } }
        )
      })
      it('should add dependency from instance to parent', () => {
        expect(dependencyChanges).toContainEqual(
          { action: 'add', dependency: { source: 1, target: 2 } }
        )
      })
    })
    describe('when reference target is not an element', () => {
      beforeEach(async () => {
        testType.annotations.annoRef = 'value'
        testInstance.value.ref = new ReferenceExpression(testTypeId.createNestedID('attr', 'bla'))
        const inputChanges = new Map([
          [0, toChange('add', testType)],
          [1, toChange('add', testInstance)],
        ])
        dependencyChanges = [...await addReferencesDependency(inputChanges, new Map())]
      })
      it('should not add dependency', () => {
        expect(dependencyChanges).toHaveLength(0)
      })
    })
  })
})
