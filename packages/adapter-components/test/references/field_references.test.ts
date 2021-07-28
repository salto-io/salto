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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, isInstanceElement, ListType } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { addReferences } from '../../src/references/field_references'
import { FieldReferenceDefinition } from '../../src/references/reference_mapping'

const ADAPTER_NAME = 'myAdapter'

describe('Field references', () => {
  const apiClientType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_client'),
    fields: {
      id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })
  const apiCollectionType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_collection'),
    fields: {
      id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      // eslint-disable-next-line camelcase
      api_client_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })
  const folderType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'folder'),
    fields: {
      id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      // eslint-disable-next-line camelcase
      parent_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })
  const apiAccessProfileType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_access_profile'),
    fields: {
      // eslint-disable-next-line camelcase
      api_client_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      // eslint-disable-next-line camelcase
      api_collection_ids: { refType: createRefToElmWithValue(new ListType(BuiltinTypes.NUMBER)) },
    },
  })
  const apiEndpointType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_endpoint'),
    fields: {
      // eslint-disable-next-line camelcase
      flow_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })

  const generateElements = (
  ): Element[] => ([
    apiClientType,
    new InstanceElement('cli123', apiClientType, { id: 123 }),
    apiCollectionType,
    new InstanceElement('collection123', apiCollectionType, { id: 123 }),
    // eslint-disable-next-line camelcase
    new InstanceElement('collection456', apiCollectionType, { id: 456, api_client_id: 123 }),
    folderType,
    // eslint-disable-next-line camelcase
    new InstanceElement('folder11', folderType, { id: 11, parent_id: 'invalid' }),
    // eslint-disable-next-line camelcase
    new InstanceElement('folder222', folderType, { id: 222, parent_id: 11 }),
    apiAccessProfileType,
    // eslint-disable-next-line camelcase
    new InstanceElement('prof1', apiAccessProfileType, { api_client_id: 123, api_collection_ids: [456] }),
    apiEndpointType,
    // eslint-disable-next-line camelcase
    new InstanceElement('ep1', apiEndpointType, { flow_id: 123 }),
  ])

  describe('addReferences', () => {
    let elements: Element[]
    const fieldNameToTypeMappingDefs: FieldReferenceDefinition[] = [
      {
        src: { field: 'api_client_id', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'id',
        target: { type: 'api_client' },
      },
      {
        src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'id',
        target: { type: 'api_collection' },
      },
      {
        src: { field: 'api_collection_id', parentTypes: ['api_endpoint'] },
        serializationStrategy: 'id',
        target: { type: 'api_collection' },
      },
      {
        src: { field: 'flow_id', parentTypes: ['api_endpoint'] },
        serializationStrategy: 'id',
        target: { type: 'recipe' },
      },
      {
        src: { field: 'parent_id', parentTypes: ['folder'] },
        serializationStrategy: 'id',
        target: { type: 'folder' },
      },
    ]

    beforeAll(async () => {
      elements = generateElements()
      await addReferences(elements, fieldNameToTypeMappingDefs)
    })

    it('should resolve field values when referenced element exists', () => {
      const prof = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_access_profile'
      )[0] as InstanceElement
      expect(prof.value.api_client_id).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_client_id?.elemID.getFullName()).toEqual('myAdapter.api_client.instance.cli123')
      expect(prof.value.api_collection_ids).toHaveLength(1)
      expect(prof.value.api_collection_ids[0]).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_collection_ids[0].elemID.getFullName()).toEqual('myAdapter.api_collection.instance.collection456')

      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder'
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[1].value.parent_id).toBeInstanceOf(ReferenceExpression)
      expect(folders[1].value.parent_id.elemID.getFullName()).toEqual('myAdapter.folder.instance.folder11')
    })

    it('should not resolve fields in unexpected types even if field name matches', () => {
      const collections = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_collection'
      ) as InstanceElement[]
      expect(collections).toHaveLength(2)
      expect(collections[1].value.api_client_id).not.toBeInstanceOf(ReferenceExpression)
      expect(collections[1].value.api_client_id).toEqual(123)
    })

    it('should not resolve if referenced element does not exist', () => {
      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder'
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[0].value.parent_id).not.toBeInstanceOf(ReferenceExpression)
      expect(folders[0].value.parent_id).toEqual('invalid')
    })
  })
})
