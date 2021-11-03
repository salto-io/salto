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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/service_url'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_TYPES, DEFAULT_ID_FIELDS } from '../../src/config'
import { WORKATO } from '../../src/constants'


describe('service_url', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let connectionInstance: InstanceElement
  let recipeInstance: InstanceElement
  let recipeCodeInstance: InstanceElement
  let folderInstance: InstanceElement
  let roleInstance: InstanceElement
  let apiCollectionInstance: InstanceElement
  let apiEndpointInstance: InstanceElement
  let propertyInstance: InstanceElement


  beforeAll(async () => {
    connectionInstance = new InstanceElement('connection', new ObjectType({ elemID: new ElemID(WORKATO, 'connection') }), { id: 1 })
    recipeInstance = new InstanceElement('recipe', new ObjectType({ elemID: new ElemID(WORKATO, 'recipe') }), { id: 2 })
    recipeCodeInstance = new InstanceElement('recipe__code', new ObjectType({ elemID: new ElemID(WORKATO, 'recipe__code') }), undefined, undefined, { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(recipeInstance.elemID, recipeInstance)] })
    folderInstance = new InstanceElement('folder', new ObjectType({ elemID: new ElemID(WORKATO, 'folder') }), { id: 4 })
    roleInstance = new InstanceElement('role', new ObjectType({ elemID: new ElemID(WORKATO, 'role') }), { id: 5 })
    apiCollectionInstance = new InstanceElement('api_collection', new ObjectType({ elemID: new ElemID(WORKATO, 'api_collection') }), { id: 6 })
    apiEndpointInstance = new InstanceElement('api_endpoint', new ObjectType({ elemID: new ElemID(WORKATO, 'api_endpoint') }), { id: 7, api_collection_id: new ReferenceExpression(apiCollectionInstance.elemID, apiCollectionInstance) })
    propertyInstance = new InstanceElement('property', new ObjectType({ elemID: new ElemID(WORKATO, 'property') }), { id: 8 })

    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          includeTypes: ['connection', 'recipe'],
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: DEFAULT_TYPES,
        },
      },
    }) as FilterType

    await filter.onFetch([
      connectionInstance,
      recipeInstance,
      recipeCodeInstance,
      folderInstance,
      roleInstance,
      apiCollectionInstance,
      apiEndpointInstance,
      propertyInstance,
    ])
  })

  it('should set the right url for connection', () => {
    expect(connectionInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/connections/1')
  })

  it('should set the right url for recipe', () => {
    expect(recipeInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/recipes/2')
  })

  it('should set the right url for recipe__code', () => {
    expect(recipeCodeInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/recipes/2')
  })

  it('should set the right url for folder', () => {
    expect(folderInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/recipes?fid=4')
  })

  it('should set the right url for role', () => {
    expect(roleInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/privilege_groups/5/edit')
  })

  it('should set the right url for api collection', () => {
    expect(apiCollectionInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/api_groups/6/endpoints')
  })

  it('should set the right url for api endpoint', () => {
    expect(apiEndpointInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/api_groups/6/endpoints/7')
  })

  it('should set the right url for property', () => {
    expect(propertyInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/account_properties')
  })
})
