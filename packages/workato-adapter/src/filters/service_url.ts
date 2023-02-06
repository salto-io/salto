/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { API_COLLECTION_TYPE, API_ENDPOINT_TYPE, CONNECTION_TYPE, FOLDER_TYPE, PROPERTY_TYPE, RECIPE_TYPE, RECIPE_CODE_TYPE, ROLE_TYPE, API_CLIENT_TYPE } from '../constants'
import { FilterCreator } from '../filter'

type GetUrlFunc = (instance: InstanceElement) => string | undefined

const BASE_URL = 'https://app.workato.com'

const getApiCollectionUrl: GetUrlFunc = instance => instance.value.id && `${BASE_URL}/api_groups/${instance.value.id}/endpoints`
const getRecipeUrl: GetUrlFunc = instance => instance.value.id && `${BASE_URL}/recipes/${instance.value.id}`
const getConnectionUrl: GetUrlFunc = instance => instance.value.id && `${BASE_URL}/connections/${instance.value.id}`
const getRecipeCodeUrl: GetUrlFunc = instance =>
  instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.value
    && getRecipeUrl(instance.annotations[CORE_ANNOTATIONS.PARENT][0].value)
const getFolderUrl: GetUrlFunc = instance => instance.value.id && `${BASE_URL}/recipes?fid=${instance.value.id}`
const getRoleUrl: GetUrlFunc = instance => instance.value.id && `${BASE_URL}/privilege_groups/${instance.value.id}/edit`
const getApiEndpointUrl: GetUrlFunc = instance => {
  const base = instance.value.api_collection_id?.value
    && getApiCollectionUrl(instance.value.api_collection_id.value)
  return instance.value.id && base && `${base}/${instance.value.id}`
}
const getPropertyUrl: GetUrlFunc = () => `${BASE_URL}/account_properties`
const getApiClientUrl: GetUrlFunc = instance => instance.value.id && `${BASE_URL}/api_customers/${instance.value.id}`

const ID_TO_URL_GENERATOR: Record<string, GetUrlFunc> = {
  [CONNECTION_TYPE]: getConnectionUrl,
  [RECIPE_TYPE]: getRecipeUrl,
  [RECIPE_CODE_TYPE]: getRecipeCodeUrl,
  [FOLDER_TYPE]: getFolderUrl,
  [ROLE_TYPE]: getRoleUrl,
  [API_COLLECTION_TYPE]: getApiCollectionUrl,
  [API_ENDPOINT_TYPE]: getApiEndpointUrl,
  [PROPERTY_TYPE]: getPropertyUrl,
  [API_CLIENT_TYPE]: getApiClientUrl,
}

const filter: FilterCreator = () => ({
  name: 'serviceUrlFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(element => element.elemID.typeName in ID_TO_URL_GENERATOR)
      .forEach(element => {
        const url = ID_TO_URL_GENERATOR[
          element.elemID.typeName
        ](element)

        if (url !== undefined) {
          element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = url
        }
      })
  },
})

export default filter
