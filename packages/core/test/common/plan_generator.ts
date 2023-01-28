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
import wu from 'wu'
import { ElemID, ObjectType, Field, BuiltinTypes, InstanceElement, getChangeData, PrimitiveType, PrimitiveTypes, Element, DependencyChanger, dependencyChange, ListType, isField, createRefToElmWithValue } from '@salto-io/adapter-api'
import * as mock from './elements'
import { getPlan, Plan } from '../../src/core/plan'
import { createElementSource } from './helpers'

export type PlanGenerators = {
  planWithTypeChanges: () => Promise<[Plan, ObjectType]>
  planWithFieldChanges: () => Promise<[Plan, ObjectType]>
  planWithNewType: () => Promise<[Plan, PrimitiveType]>
  planWithInstanceChange: () => Promise<[Plan, InstanceElement]>
  planWithListChange: () => Promise<[Plan, InstanceElement]>
  planWithAnnotationTypesChanges: () => Promise<[Plan, ObjectType]>
  planWithFieldIsListChanges: () => Promise<[Plan, ObjectType]>
  planWithFieldDependency: (isAdd: boolean) => Promise<[Plan, Field]>
  planWithFieldDependencyCycle: (isAdd: boolean) => Promise<Plan>
  planWithDependencyCycle: (withValidator: boolean) => Promise<Plan>
  planWithDependencyCycleWithinAGroup: (withValidator: boolean) => Promise<Plan>
}

export const planGenerators = (allElements: ReadonlyArray<Element>): PlanGenerators => ({
  planWithTypeChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    saltoOffice.annotations.label = 'new label'
    saltoOffice.annotations.new = 'new annotation'
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
    })
    return [plan, saltoOffice]
  },

  planWithFieldChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    // Adding new field
    saltoOffice.fields.new = new Field(saltoOffice, 'new', BuiltinTypes.STRING)
    // Sub element change
    saltoOffice.fields.location.annotations.label = 'new label'
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
    })
    return [plan, saltoOffice]
  },

  planWithNewType: async () => {
    const newElement = new PrimitiveType({
      elemID: new ElemID('salto', 'additional'),
      primitive: PrimitiveTypes.STRING,
    })
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource([...allElements, newElement]),
    })
    return [plan, newElement]
  },

  planWithInstanceChange: async () => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4]
    updatedEmployee.value.nicknames[1] = 'new'
    delete updatedEmployee.value.office.name
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
    })
    return [plan, updatedEmployee]
  },

  planWithListChange: async () => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4]
    updatedEmployee.value.nicknames.push('new')
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
    })
    return [plan, updatedEmployee]
  },

  planWithAnnotationTypesChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    const saltoAddress = afterElements[1]
    // update annotation types
    saltoOffice.annotationRefTypes.new = createRefToElmWithValue(BuiltinTypes.STRING)
    saltoOffice.annotationRefTypes.address = createRefToElmWithValue(
      saltoAddress.clone({ label: 'test label' })
    )
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
    })
    return [plan, saltoOffice]
  },

  planWithFieldIsListChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    saltoOffice.fields.name.refType = createRefToElmWithValue(
      new ListType(saltoOffice.fields.name.refType)
    )
    saltoOffice.fields.rooms.refType = createRefToElmWithValue(BuiltinTypes.STRING)
    const plan = await getPlan({
      before: createElementSource(allElements),
      after: createElementSource(afterElements),
    })
    return [plan, saltoOffice]
  },

  planWithFieldDependency: async isAdd => {
    const afterElements = mock.getAllElements()
    const [,, saltoOffice, saltoEmployee] = afterElements
    const afterSaltoOffice = saltoOffice.clone()
    afterSaltoOffice.annotations.label = 'updated'
    afterSaltoOffice.fields.test = new Field(afterSaltoOffice, 'test', BuiltinTypes.STRING)
    const depChanger: DependencyChanger = async changes => {
      const changeByElem = new Map(
        wu(changes).map(([id, change]) => [getChangeData(change).elemID.getFullName(), id]),
      )
      const officeChange = changeByElem.get(afterSaltoOffice.elemID.getFullName())
      const officeFieldChange = changeByElem.get(afterSaltoOffice.fields.test.elemID.getFullName())
      const employeeChange = changeByElem.get(saltoEmployee.elemID.getFullName())
      if (officeChange && officeFieldChange && employeeChange) {
        return [
          dependencyChange('add', employeeChange, officeChange),
          dependencyChange('add', officeFieldChange, employeeChange),
        ]
      }
      return []
    }
    const afterElementsForPlan = afterElements
      .filter(elem => !elem.elemID.isEqual(saltoOffice.elemID))
      .concat(afterSaltoOffice)
    const plan = isAdd
      ? await getPlan({
        before: createElementSource([]),
        after: createElementSource(afterElementsForPlan),
        dependencyChangers: [depChanger],
        customGroupIdFunctions: {
          salto: async changes => ({
            changeGroupIdMap: new Map(
              wu(changes.entries())
                .filter(([_id, change]) => getChangeData(change).elemID.isEqual(afterSaltoOffice.fields.test.elemID))
                .map(([id]) => [id, 'separated group'])
            ),
          }),
        },
      })
      : await getPlan({
        before: createElementSource([saltoOffice]),
        after: createElementSource(afterElementsForPlan),
        dependencyChangers: [depChanger],
      })
    return [plan, afterSaltoOffice.fields.test]
  },

  planWithFieldDependencyCycle: async isAdd => {
    const afterElements = mock.getAllElements()
    const [,, saltoOffice, saltoEmployee] = afterElements
    saltoOffice.fields.test = new Field(saltoOffice, 'test', BuiltinTypes.STRING)
    const depChanger: DependencyChanger = async changes => {
      const changeByElem = new Map(
        wu(changes).map(([id, change]) => [getChangeData(change).elemID.getFullName(), id]),
      )
      const officeChange = changeByElem.get(saltoOffice.elemID.getFullName())
      const officeFieldChange = changeByElem.get(saltoOffice.fields.test.elemID.getFullName())
      const employeeChange = changeByElem.get(saltoEmployee.elemID.getFullName())
      if (officeChange && officeFieldChange && employeeChange) {
        return isAdd
          ? [
            dependencyChange('add', employeeChange, officeChange),
            dependencyChange('add', officeFieldChange, employeeChange),
          ]
          : [
            dependencyChange('add', officeChange, employeeChange),
            dependencyChange('add', employeeChange, officeFieldChange),
          ]
      }
      return []
    }
    return isAdd
      ? getPlan({
        before: createElementSource([]),
        after: createElementSource(afterElements),
        dependencyChangers: [depChanger],
      })
      : getPlan({
        before: createElementSource(afterElements),
        after: createElementSource([]),
        dependencyChangers: [depChanger],
      })
  },

  planWithDependencyCycleWithinAGroup: async withValidator => {
    const afterElements = mock.getAllElements()
    const [,, saltoOffice] = afterElements
    const depChanger: DependencyChanger = async changes => {
      const officeFieldChangeIds = wu(changes)
        .filter(([_id, change]) => {
          const elem = getChangeData(change)
          return isField(elem) && elem.parent.elemID.isEqual(saltoOffice.elemID)
        })
        .map(([id]) => id)
        .slice(0, 2)
        .toArray()
      return [
        dependencyChange('add', officeFieldChangeIds[0], officeFieldChangeIds[1]),
        dependencyChange('add', officeFieldChangeIds[1], officeFieldChangeIds[0]),
      ]
    }
    return getPlan({
      before: createElementSource([]),
      after: createElementSource(afterElements),
      dependencyChangers: [depChanger],
      changeValidators: withValidator ? { salto: async () => [] } : {},
    })
  },
  planWithDependencyCycle: async withValidator => {
    const afterElements = mock.getAllElements()
    const depChanger: DependencyChanger = async changes => {
      const officeFieldChangeIds = wu(changes)
        .filter(([_id, change]) => {
          const elem = getChangeData(change)
          return elem.elemID.getFullName() === 'salto.office.field.name'
            || elem.elemID.getFullName() === 'salto.employee.field.office'
        })
        .map(([id]) => id)
        .slice(0, 2)
        .toArray()
      return [
        dependencyChange('add', officeFieldChangeIds[0], officeFieldChangeIds[1]),
        dependencyChange('add', officeFieldChangeIds[1], officeFieldChangeIds[0]),
      ]
    }
    return getPlan({
      before: createElementSource([]),
      after: createElementSource(afterElements),
      dependencyChangers: [depChanger],
      changeValidators: withValidator ? { salto: async () => [] } : {},
    })
  },
})
