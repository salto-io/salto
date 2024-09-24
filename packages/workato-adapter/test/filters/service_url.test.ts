/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/service_url'
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
import { getFilterParams } from '../utils'

describe('service_url', () => {
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

    filter = filterCreator(getFilterParams()) as FilterType

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
