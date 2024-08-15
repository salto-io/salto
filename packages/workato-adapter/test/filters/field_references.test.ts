/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
  BuiltinTypes,
  isInstanceElement,
  ListType,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/field_references'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { getDefaultConfig } from '../../src/config'
import { WORKATO } from '../../src/constants'

describe('Field references filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    client = new WorkatoClient({
      credentials: { username: 'a', token: 'b' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: getDefaultConfig(),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  const apiClientType = new ObjectType({
    elemID: new ElemID(WORKATO, 'api_client'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const apiCollectionType = new ObjectType({
    elemID: new ElemID(WORKATO, 'api_collection'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      api_client_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const folderType = new ObjectType({
    elemID: new ElemID(WORKATO, 'folder'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      parent_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const apiAccessProfileType = new ObjectType({
    elemID: new ElemID(WORKATO, 'api_access_profile'),
    fields: {
      api_client_id: { refType: BuiltinTypes.NUMBER },
      api_collection_ids: { refType: new ListType(BuiltinTypes.NUMBER) },
    },
  })
  const apiEndpointType = new ObjectType({
    elemID: new ElemID(WORKATO, 'api_endpoint'),
    fields: {
      flow_id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const generateElements = (): Element[] => [
    apiClientType,
    new InstanceElement('cli123', apiClientType, { id: 123 }),
    apiCollectionType,
    new InstanceElement('collection123', apiCollectionType, { id: 123 }),
    new InstanceElement('collection456', apiCollectionType, { id: 456, api_client_id: 123 }),
    folderType,
    new InstanceElement('folder11', folderType, { id: 11, parent_id: 'invalid' }),
    new InstanceElement('folder222', folderType, { id: 222, parent_id: 11 }),
    apiAccessProfileType,
    new InstanceElement('prof1', apiAccessProfileType, { api_client_id: 123, api_collection_ids: [456] }),
    apiEndpointType,
    new InstanceElement('ep1', apiEndpointType, { flow_id: 123 }),
  ]

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve field values when referenced element exists', () => {
      const prof = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_access_profile',
      )[0] as InstanceElement
      expect(prof.value.api_client_id).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_client_id?.elemID.getFullName()).toEqual('workato.api_client.instance.cli123')
      expect(prof.value.api_collection_ids).toHaveLength(1)
      expect(prof.value.api_collection_ids[0]).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_collection_ids[0].elemID.getFullName()).toEqual(
        'workato.api_collection.instance.collection456',
      )

      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder',
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[1].value.parent_id).toBeInstanceOf(ReferenceExpression)
      expect(folders[1].value.parent_id.elemID.getFullName()).toEqual('workato.folder.instance.folder11')
    })

    it('should not resolve fields in unexpected types even if field name matches', () => {
      const collections = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_collection',
      ) as InstanceElement[]
      expect(collections).toHaveLength(2)
      expect(collections[1].value.api_client_id).not.toBeInstanceOf(ReferenceExpression)
      expect(collections[1].value.api_client_id).toEqual(123)
    })

    it('should not resolve if referenced element does not exist', () => {
      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder',
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[0].value.parent_id).not.toBeInstanceOf(ReferenceExpression)
      expect(folders[0].value.parent_id).toEqual('invalid')
    })
  })
})
