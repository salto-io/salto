/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ListType, MapType, ObjectType, ReferenceExpression, TypeReference } from '@salto-io/adapter-api'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { createAdapterReplacedID, updateElementsWithAlternativeAccount } from '../../src/element_adapter_rename'
import { UnresolvedReference } from '../../src/expressions'

describe('when replacing id adapter', () => {
  it('creates a new elemID with different id', () => {
    const origID = new ElemID('1', '2', 'instance', '4')
    expect(createAdapterReplacedID(origID, '5').getFullName()).toEqual('5.2.instance.4')
  })
  it('doesnt change global elemID', () => {
    const origID = new ElemID('', '2', 'instance', '4')
    expect(createAdapterReplacedID(origID, '5')).toEqual(origID)
  })
  it('doesnt change var elemID', () => {
    const origID = new ElemID('var', '2', 'var')
    expect(createAdapterReplacedID(origID, '5')).toEqual(origID)
  })
})
describe('rename adapter in elements', () => {
  const serviceName = 'salesforce'
  const newServiceName = 's1'
  const innerRefType = new ObjectType({ elemID: new ElemID(serviceName, 'inner') })
  const innerType = new ObjectType({
    elemID: new ElemID(serviceName, 'typeInContainers'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    annotationRefsOrTypes: {
      someRef: innerRefType,
    },
  })
  const objectToChange = new ObjectType({
    elemID: new ElemID(serviceName, 'objectType'),
    path: [serviceName, 'somepath'],
    fields: {
      field: { refType: innerType },
      listField: { refType: new ListType(innerType) },
      listOfListField: { refType: new ListType(new ListType(innerType)) },
      mapField: { refType: new MapType(innerType) },
      mapOfMapField: { refType: new MapType(new MapType(innerType)) },
    },
  })
  const instanceToChange = new InstanceElement('InstanceElement', objectToChange, {
    field: new ReferenceExpression(innerType.elemID),
    innerRefField: innerType,
  })
  // the adapter change is supposed to set this value to undefined if it finds unresolved reference.
  instanceToChange.value.field.value = new UnresolvedReference(innerType.elemID)
  const unresolvedReferenceInstanceToChange = new InstanceElement('InstanceElement',
    new TypeReference(objectToChange.elemID))
  const changedInnerRefType = new ObjectType({ elemID: new ElemID(newServiceName, 'inner') })
  const changedInnerType = new ObjectType({
    elemID: new ElemID(newServiceName, 'typeInContainers'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
    },
    annotationRefsOrTypes: {
      someRef: changedInnerRefType,
    },
  })
  const changedObject = new ObjectType({
    path: [newServiceName, 'somepath'],
    elemID: new ElemID(newServiceName, 'objectType'),
    fields: {
      field: { refType: changedInnerType },
      listField: { refType: new ListType(changedInnerType) },
      listOfListField: { refType: new ListType(new ListType(changedInnerType)) },
      mapField: { refType: new MapType(changedInnerType) },
      mapOfMapField: { refType: new MapType(new MapType(changedInnerType)) },
    },
  })
  const changedInstance = new InstanceElement('InstanceElement', changedObject, {
    field: new ReferenceExpression(changedInnerType.elemID),
    innerRefField: changedInnerType,
  })
  const changedUnresolvedReferenceInstanceToChange = new InstanceElement('InstanceElement',
    new TypeReference(changedObject.elemID))
  beforeEach(async () => {
    await updateElementsWithAlternativeAccount([
      objectToChange,
      instanceToChange,
      unresolvedReferenceInstanceToChange,
    ], newServiceName, serviceName, createInMemoryElementSource())
  })

  it('updates objectType with new id', () => {
    expect(objectToChange.isEqual(changedObject)).toBeTruthy()
  })

  it('updates InstanceElement with new id', () => {
    // These fields represent a resolved value that is not supposed to be manipulated by
    // adapter manipulation
    changedInstance.value.innerRefField.annotationRefTypes.someRef.type = instanceToChange
      .value.innerRefField.annotationRefTypes.someRef.type
    changedInstance.value.innerRefField.fields.value = instanceToChange
      .value.innerRefField.fields.value
    expect(instanceToChange.isEqual(changedInstance)).toBeTruthy()
  })

  it('updates InstanceElement with unresolved type', () => {
    expect(changedUnresolvedReferenceInstanceToChange
      .isEqual(unresolvedReferenceInstanceToChange)).toBeTruthy()
  })
})
