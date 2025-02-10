/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  BuiltinTypes,
  ElemID,
  ObjectType,
  InstanceElement,
  PrimitiveType,
  ListType,
  MapType,
  ReferenceExpression,
  Field,
  Element,
} from '@salto-io/adapter-api'

type AllElementsTypes = [
  PrimitiveType,
  ObjectType,
  ObjectType,
  ObjectType,
  InstanceElement,
  ListType,
  MapType,
  InstanceElement,
  InstanceElement,
  Field,
]
const getAllElements = (accountName = 'salto'): AllElementsTypes => {
  const addrElemID = new ElemID(accountName, 'address')
  const saltoAddr = new ObjectType({
    elemID: addrElemID,
    fields: {
      country: { refType: BuiltinTypes.STRING },
      city: { refType: BuiltinTypes.STRING },
    },
    annotationRefsOrTypes: { label: BuiltinTypes.STRING },
  })

  const officeElemID = new ElemID(accountName, 'office')
  const saltoOffice = new ObjectType({
    elemID: officeElemID,
    fields: {
      name: { refType: BuiltinTypes.STRING },
      location: {
        refType: saltoAddr,
        annotations: {
          label: 'Office Location',
          description: 'A location of an office',
        },
      },
      rooms: { refType: new ListType(BuiltinTypes.STRING) },
      seats: { refType: new MapType(BuiltinTypes.STRING) },
    },
    annotationRefsOrTypes: {
      label: BuiltinTypes.STRING,
      old: BuiltinTypes.STRING,
      case_sensitive: BuiltinTypes.BOOLEAN,
      address: saltoAddr,
    },
  })

  const employeeElemID = new ElemID(accountName, 'employee')
  const stringListType = new ListType(BuiltinTypes.STRING)
  const stringMapType = new MapType(BuiltinTypes.STRING)
  const saltoEmployee = new ObjectType({
    elemID: employeeElemID,
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
        annotations: { _required: true },
      },
      nicknames: {
        refType: stringListType,
        annotations: {},
      },
      company: {
        refType: BuiltinTypes.STRING,
        annotations: { _default: 'salto' },
      },
      office: {
        refType: saltoOffice,
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

  const saltoEmployeeInstance = new InstanceElement('instance', saltoEmployee, {
    name: 'FirstEmployee',
    nicknames: ['you', 'hi'],
    office: { label: 'bla', name: 'foo', seats: { c1: 'n1', c2: 'n2' } },
  })

  const saltoEmployeeToRename = new InstanceElement('original', saltoEmployee, {
    name: 'FirstEmployee',
    nicknames: ['you', 'hi'],
    office: { label: 'bla', name: 'foo', seats: { c1: 'n1', c2: 'n2' } },
    friend: new ReferenceExpression(employeeElemID.createNestedID('instance', 'original')),
  })

  const anotherSaltoEmployeeInstance = new InstanceElement('anotherInstance', saltoEmployee, {
    name: 'FirstEmployee',
    nicknames: ['you', 'hi'],
    office: { label: 'bla', name: 'foo', seats: { c1: 'n1', c2: 'n2' } },
    friend: new ReferenceExpression(saltoEmployeeToRename.elemID),
    parent: new ReferenceExpression(saltoEmployee.elemID),
  })

  const fieldElement = new Field(saltoAddr, 'country', BuiltinTypes.STRING)

  return [
    BuiltinTypes.STRING,
    saltoAddr,
    saltoOffice,
    saltoEmployee,
    saltoEmployeeInstance,
    stringListType,
    stringMapType,
    saltoEmployeeToRename,
    anotherSaltoEmployeeInstance,
    fieldElement,
  ]
}

export const getTopLevelElements = (accountName = 'salto'): Element[] =>
  getAllElements(accountName)
    .filter(elem => elem.elemID.isTopLevel())
    .filter(elem => elem.elemID.adapter === accountName)
