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
import { ElemID, ObjectType, Field, BuiltinTypes, InstanceElement, getChangeElement, PrimitiveType, PrimitiveTypes, Element, DependencyChanger, dependencyChange, ListType, isField } from '@salto-io/adapter-api'
import * as mock from './elements'
import { getPlan, Plan } from '../../src/core/plan'

export type PlanGenerators = {
  planWithTypeChanges: () => Promise<[Plan, ObjectType]>
  planWithFieldChanges: () => Promise<[Plan, ObjectType]>
  planWithNewType: () => Promise<[Plan, PrimitiveType]>
  planWithInstanceChange: () => Promise<[Plan, InstanceElement]>
  planWithListChange: () => Promise<[Plan, InstanceElement]>
  planWithAnnotationTypesChanges: () => Promise<[Plan, ObjectType]>
  planWithFieldIsListChanges: () => Promise<[Plan, ObjectType]>
  planWithSplitElem: (isAdd: boolean) => Promise<[Plan, ObjectType]>
  planWithDependencyCycle: (withValidator: boolean) => Promise<Plan>
}

export const planGenerators = (allElements: ReadonlyArray<Element>): PlanGenerators => ({
  planWithTypeChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    saltoOffice.annotations.label = 'new label'
    saltoOffice.annotations.new = 'new annotation'
    const plan = await getPlan({ before: allElements, after: afterElements })
    return [plan, saltoOffice]
  },

  planWithFieldChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    // Adding new field
    saltoOffice.fields.new = new Field(saltoOffice, 'new', BuiltinTypes.STRING)
    // Sub element change
    saltoOffice.fields.location.annotations.label = 'new label'
    const plan = await getPlan({ before: allElements, after: afterElements })
    return [plan, saltoOffice]
  },

  planWithNewType: async () => {
    const newElement = new PrimitiveType({
      elemID: new ElemID('salto', 'additional'),
      primitive: PrimitiveTypes.STRING,
    })
    const plan = await getPlan({ before: allElements, after: [...allElements, newElement] })
    return [plan, newElement]
  },

  planWithInstanceChange: async () => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4]
    updatedEmployee.value.nicknames[1] = 'new'
    delete updatedEmployee.value.office.name
    const plan = await getPlan({ before: allElements, after: afterElements })
    return [plan, updatedEmployee]
  },

  planWithListChange: async () => {
    const afterElements = mock.getAllElements()
    const updatedEmployee = afterElements[4]
    updatedEmployee.value.nicknames.push('new')
    const plan = await getPlan({ before: allElements, after: afterElements })
    return [plan, updatedEmployee]
  },

  planWithAnnotationTypesChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    const saltoAddress = afterElements[1]
    // update annotation types
    saltoOffice.annotationTypes.new = BuiltinTypes.STRING
    saltoOffice.annotationTypes.address = saltoAddress.clone({ label: 'test label' })
    const plan = await getPlan({ before: allElements, after: afterElements })
    return [plan, saltoOffice]
  },

  planWithFieldIsListChanges: async () => {
    const afterElements = mock.getAllElements()
    const saltoOffice = afterElements[2]
    saltoOffice.fields.name.type = new ListType(saltoOffice.fields.name.type)
    saltoOffice.fields.rooms.type = BuiltinTypes.STRING
    const plan = await getPlan({ before: allElements, after: afterElements })
    return [plan, saltoOffice]
  },

  planWithSplitElem: async isAdd => {
    const afterElements = mock.getAllElements()
    const [,, saltoOffice, saltoEmployee] = afterElements
    saltoOffice.fields.test = new Field(saltoOffice, 'test', BuiltinTypes.STRING)
    const depChanger: DependencyChanger = async changes => {
      const changeByElem = new Map(
        wu(changes).map(([id, change]) => [getChangeElement(change).elemID.getFullName(), id]),
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
    const plan = isAdd
      ? await getPlan({ before: [], after: afterElements, dependencyChangers: [depChanger] })
      : await getPlan({ before: afterElements, after: [], dependencyChangers: [depChanger] })
    return [plan, saltoOffice]
  },

  planWithDependencyCycle: async withValidator => {
    const afterElements = mock.getAllElements()
    const [,, saltoOffice] = afterElements
    const depChanger: DependencyChanger = async changes => {
      const officeFieldChangeIds = wu(changes)
        .filter(([_id, change]) => {
          const elem = getChangeElement(change)
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
      before: [],
      after: afterElements,
      dependencyChangers: [depChanger],
      changeValidators: withValidator ? { salto: async () => [] } : {},
    })
  },
})
