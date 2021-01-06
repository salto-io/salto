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
import { CORE_ANNOTATIONS, BuiltinTypes, ElemID, ObjectType, InstanceElement, PrimitiveType, ListType, MapType } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'

type AllElementsTypes = [PrimitiveType, ObjectType, ObjectType,
    ObjectType, InstanceElement, ListType, MapType]
export const getAllElements = (): AllElementsTypes => {
  const addrElemID = new ElemID('salto', 'address')
  const saltoAddr = new ObjectType({
    elemID: addrElemID,
    fields: {
      country: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      city: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    },
    annotationRefsOrTypes: { label: BuiltinTypes.STRING },
  })

  const officeElemID = new ElemID('salto', 'office')
  const saltoOffice = new ObjectType({
    elemID: officeElemID,
    fields: {
      name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      location: {
        refType: createRefToElmWithValue(saltoAddr),
        annotations: {
          label: 'Office Location',
          description: 'A location of an office',
        },
      },
      rooms: { refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)) },
      seats: { refType: createRefToElmWithValue(new MapType(BuiltinTypes.STRING)) },
    },
    annotationRefsOrTypes: {
      label: BuiltinTypes.STRING,
      old: BuiltinTypes.STRING,
      // eslint-disable-next-line @typescript-eslint/camelcase
      case_sensitive: BuiltinTypes.BOOLEAN,
      address: saltoAddr,
    },
  })

  const employeeElemID = new ElemID('salto', 'employee')
  const stringListType = new ListType(BuiltinTypes.STRING)
  const stringMapType = new MapType(BuiltinTypes.STRING)
  const saltoEmployee = new ObjectType({
    elemID: employeeElemID,
    fields: {
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: { _required: true },
      },
      nicknames: {
        refType: createRefToElmWithValue(stringListType),
        annotations: {},
      },
      company: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: { _default: 'salto' },
      },
      office: {
        refType: createRefToElmWithValue(saltoOffice),
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
    { name: 'FirstEmployee', nicknames: ['you', 'hi'], office: { label: 'bla', name: 'foo', seats: { c1: 'n1', c2: 'n2' } } }
  )

  return [BuiltinTypes.STRING, saltoAddr, saltoOffice,
    saltoEmployee, saltoEmployeeInstance, stringListType, stringMapType]
}
