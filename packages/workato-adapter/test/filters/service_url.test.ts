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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/service_url'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { getDefaultConfig } from '../../src/config'
import {
  CONNECTION_TYPE,
  RECIPE_TYPE,
  RECIPE_CODE_TYPE,
  WORKATO,
  FOLDER_TYPE,
  ROLE_TYPE,
  API_COLLECTION_TYPE,
  API_ENDPOINT_TYPE,
  PROPERTY_TYPE,
  API_CLIENT_TYPE,
} from '../../src/constants'

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
  let apiClientInstance: InstanceElement

  beforeAll(async () => {
    connectionInstance = new InstanceElement(
      CONNECTION_TYPE,
      new ObjectType({ elemID: new ElemID(WORKATO, CONNECTION_TYPE) }),
      { id: 1 },
    )
    recipeInstance = new InstanceElement(RECIPE_TYPE, new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE) }), {
      id: 2,
    })
    recipeCodeInstance = new InstanceElement(
      RECIPE_CODE_TYPE,
      new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_CODE_TYPE) }),
      undefined,
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(recipeInstance.elemID, recipeInstance)] },
    )
    folderInstance = new InstanceElement(FOLDER_TYPE, new ObjectType({ elemID: new ElemID(WORKATO, FOLDER_TYPE) }), {
      id: 4,
    })
    roleInstance = new InstanceElement(ROLE_TYPE, new ObjectType({ elemID: new ElemID(WORKATO, ROLE_TYPE) }), { id: 5 })
    apiCollectionInstance = new InstanceElement(
      API_COLLECTION_TYPE,
      new ObjectType({ elemID: new ElemID(WORKATO, API_COLLECTION_TYPE) }),
      { id: 6 },
    )
    apiEndpointInstance = new InstanceElement(
      API_ENDPOINT_TYPE,
      new ObjectType({ elemID: new ElemID(WORKATO, API_ENDPOINT_TYPE) }),
      {
        id: 7,
        api_collection_id: new ReferenceExpression(apiCollectionInstance.elemID, apiCollectionInstance),
      },
    )
    propertyInstance = new InstanceElement(
      PROPERTY_TYPE,
      new ObjectType({ elemID: new ElemID(WORKATO, PROPERTY_TYPE) }),
      { id: 8 },
    )

    apiClientInstance = new InstanceElement(
      PROPERTY_TYPE,
      new ObjectType({ elemID: new ElemID(WORKATO, API_CLIENT_TYPE) }),
      { id: 9 },
    )

    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: getDefaultConfig(),
      fetchQuery: elementUtils.query.createMockQuery(),
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
      apiClientInstance,
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
    expect(roleInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://app.workato.com/privilege_groups/5/edit',
    )
  })

  it('should set the right url for api collection', () => {
    expect(apiCollectionInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://app.workato.com/api_groups/6/endpoints',
    )
  })

  it('should set the right url for api endpoint', () => {
    expect(apiEndpointInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://app.workato.com/api_groups/6/endpoints/7',
    )
  })

  it('should set the right url for property', () => {
    expect(propertyInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://app.workato.com/account_properties',
    )
  })

  it('should set the right url for api client', () => {
    expect(apiClientInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://app.workato.com/api_customers/9')
  })
})
