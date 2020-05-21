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
import {
  CORE_ANNOTATIONS, BuiltinTypes, ElemID, ObjectType, InstanceElement,
  PrimitiveType, ListType,
} from '@salto-io/adapter-api'

type AllElementsTypes = [PrimitiveType, ObjectType, ObjectType,
    ObjectType, InstanceElement, ListType]
export const getAllElements = (): AllElementsTypes => {
  const addrElemID = new ElemID('salto', 'address')
  const saltoAddr = new ObjectType({
    elemID: addrElemID,
    fields: {
      country: { type: BuiltinTypes.STRING },
      city: { type: BuiltinTypes.STRING },
    },
    annotationTypes: { label: BuiltinTypes.STRING },
  })

  const officeElemID = new ElemID('salto', 'office')
  const saltoOffice = new ObjectType({
    elemID: officeElemID,
    fields: {
      name: { type: BuiltinTypes.STRING },
      location: {
        type: saltoAddr,
        annotations: {
          label: 'Office Location',
          description: 'A location of an office',
        },
      },
      rooms: { type: new ListType(BuiltinTypes.STRING) },
    },
    // eslint-disable-next-line @typescript-eslint/camelcase,max-len
    annotationTypes: { label: BuiltinTypes.STRING, old: BuiltinTypes.STRING, case_sensitive: BuiltinTypes.BOOLEAN },
  })

  const employeeElemID = new ElemID('salto', 'employee')
  const stringListType = new ListType(BuiltinTypes.STRING)
  const saltoEmployee = new ObjectType({
    elemID: employeeElemID,
    fields: {
      name: {
        type: BuiltinTypes.STRING,
        annotations: { _required: true },
      },
      nicknames: {
        type: stringListType,
        annotations: {},
      },
      company: {
        type: BuiltinTypes.STRING,
        annotations: { _default: 'salto' },
      },
      office: {
        type: saltoOffice,
        annotations: {
          label: 'Based In',
          name: {
            [CORE_ANNOTATIONS.DEFAULT]: 'HQ',
          },
          location: {
            country: {
              [CORE_ANNOTATIONS.DEFAULT]: 'IL',
            },
            city: {
              [CORE_ANNOTATIONS.DEFAULT]: 'Raanana',
            },
          },
        },
      },
    },
  })

  const saltoEmployeeInstance = new InstanceElement(
    'instance',
    saltoEmployee,
    { name: 'FirstEmployee', nicknames: ['you', 'hi'], office: { label: 'bla', name: 'foo' } }
  )

  return [BuiltinTypes.STRING, saltoAddr, saltoOffice,
    saltoEmployee, saltoEmployeeInstance, stringListType]
}
