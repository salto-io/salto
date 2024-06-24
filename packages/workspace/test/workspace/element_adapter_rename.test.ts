/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  TemplateExpression,
  TypeElement,
  TypeReference,
  UnresolvedReference,
} from '@salto-io/adapter-api'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import {
  buildContainerTypeId,
  createAdapterReplacedID,
  updateElementsWithAlternativeAccount,
} from '../../src/element_adapter_rename'

describe('buildContainerTypeId', () => {
  it.each([
    ['list', ListType],
    ['map', MapType],
  ])('with %s prefix', (_name, containerType) => {
    const id = containerType.createElemID(BuiltinTypes.STRING)
    const containerInfo = id.getContainerPrefixAndInnerType()
    if (containerInfo !== undefined) {
      expect(buildContainerTypeId(containerInfo.prefix, BuiltinTypes.STRING.elemID)).toEqual(id)
    }
  })
})

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
  it('changes container type inner type ids', () => {
    const origID = MapType.createElemID(
      new TypeReference(ListType.createElemID(new TypeReference(new ElemID('bla', 'foo')))),
    )
    expect(createAdapterReplacedID(origID, 'foo').getFullName()).toEqual('Map<List<foo.foo>>')
  })
})
describe('rename adapter in elements', () => {
  describe.each([
    ['resolved inner ref types', true],
    ['unresolved inner ref types', false],
  ])('with %s', (_testName, resolvedInnerRefs) => {
    const createRefType = (type: TypeElement): TypeReference =>
      new TypeReference(type.elemID, resolvedInnerRefs ? type : undefined)

    const serviceName = 'salesforce'
    const newServiceName = 's1'
    const innerRefType = new ObjectType({ elemID: new ElemID(serviceName, 'inner') })
    const innerType = new ObjectType({
      elemID: new ElemID(serviceName, 'typeInContainers'),
      fields: {
        value: { refType: BuiltinTypes.STRING },
      },
      annotationRefsOrTypes: {
        someRef: createRefType(innerRefType),
      },
    })
    const objectToChange = new ObjectType({
      elemID: new ElemID(serviceName, 'objectType'),
      path: [serviceName, 'somepath'],
      fields: {
        field: { refType: createRefType(innerType) },
        templateField: { refType: createRefType(innerType) },
        listField: { refType: createRefType(new ListType(createRefType(innerType))) },
        listOfListField: {
          refType: createRefType(new ListType(createRefType(new ListType(createRefType(innerType))))),
        },
        mapField: { refType: createRefType(new MapType(createRefType(innerType))) },
        mapOfMapField: { refType: createRefType(new MapType(createRefType(new MapType(createRefType(innerType))))) },
      },
    })
    const staticFileToChange = new StaticFile({
      filepath: `static-resources/${serviceName}/test${serviceName}.txt`,
      content: Buffer.from('test'),
    })
    const instanceToChange = new InstanceElement('InstanceElement', objectToChange, {
      field: new ReferenceExpression(innerType.elemID),
      templateField: new TemplateExpression({
        parts: [
          'prefix',
          new ReferenceExpression(innerType.elemID),
          'middle',
          new ReferenceExpression(innerRefType.elemID),
        ],
      }),
      innerRefField: innerType,
      staticFileField: staticFileToChange,
    })
    // the adapter change is supposed to set this value to undefined if it finds unresolved reference.
    instanceToChange.value.field.value = new UnresolvedReference(innerType.elemID)
    const unresolvedReferenceInstanceToChange = new InstanceElement(
      'InstanceElement',
      new TypeReference(objectToChange.elemID),
    )
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
        templateField: { refType: changedInnerType },
        listField: { refType: new ListType(changedInnerType) },
        listOfListField: { refType: new ListType(new ListType(changedInnerType)) },
        mapField: { refType: new MapType(changedInnerType) },
        mapOfMapField: { refType: new MapType(new MapType(changedInnerType)) },
      },
    })
    const changedStaticFile = new StaticFile({
      filepath: `static-resources/${newServiceName}/test${serviceName}.txt`,
      content: Buffer.from('test'),
    })
    const changedInstance = new InstanceElement('InstanceElement', changedObject, {
      field: new ReferenceExpression(changedInnerType.elemID),
      templateField: new TemplateExpression({
        parts: [
          'prefix',
          new ReferenceExpression(changedInnerType.elemID),
          'middle',
          new ReferenceExpression(changedInnerRefType.elemID),
        ],
      }),
      innerRefField: changedInnerType,
      staticFileField: changedStaticFile,
    })
    const changedUnresolvedReferenceInstanceToChange = new InstanceElement(
      'InstanceElement',
      new TypeReference(changedObject.elemID),
    )
    beforeEach(async () => {
      await updateElementsWithAlternativeAccount(
        [objectToChange, instanceToChange, unresolvedReferenceInstanceToChange],
        newServiceName,
        serviceName,
        createInMemoryElementSource(),
      )
    })

    it('updates objectType with new id', () => {
      expect(objectToChange.isEqual(changedObject)).toBeTruthy()
    })

    it('updates InstanceElement with new id', () => {
      // These fields represent a resolved value that is not supposed to be manipulated by
      // adapter manipulation
      changedInstance.value.innerRefField.annotationRefTypes.someRef.type =
        instanceToChange.value.innerRefField.annotationRefTypes.someRef.type
      changedInstance.value.innerRefField.fields.value = instanceToChange.value.innerRefField.fields.value
      expect(instanceToChange.value.staticFileField).toEqual(changedInstance.value.staticFileField)
      expect(instanceToChange.isEqual(changedInstance)).toBeTruthy()
    })

    it('updates InstanceElement with unresolved type', () => {
      expect(changedUnresolvedReferenceInstanceToChange.isEqual(unresolvedReferenceInstanceToChange)).toBeTruthy()
    })
  })
})
