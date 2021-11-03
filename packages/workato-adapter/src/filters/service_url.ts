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
import { CORE_ANNOTATIONS, Element, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { WORKATO } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const baseURL = 'https://app.workato.com'
const getApiCollectionUrl = (instance: InstanceElement): string | undefined => instance.value.id && `${baseURL}/api_groups/${instance.value.id}/endpoints`
const getRecipeUrl = (instance: InstanceElement): string | undefined => instance.value.id && `${baseURL}/recipes/${instance.value.id}`

const ID_TO_URL_GENERATOR: Record<string, (instance: InstanceElement) => string | undefined> = {
  [new ElemID(WORKATO, 'connection').getFullName()]: instance => instance.value.id && `${baseURL}/connections/${instance.value.id}`,
  [new ElemID(WORKATO, 'recipe').getFullName()]: getRecipeUrl,
  [new ElemID(WORKATO, 'recipe__code').getFullName()]: instance => instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.value && getRecipeUrl(instance.annotations[CORE_ANNOTATIONS.PARENT][0].value),
  [new ElemID(WORKATO, 'folder').getFullName()]: instance => instance.value.id && `${baseURL}/recipes?fid=${instance.value.id}`,
  [new ElemID(WORKATO, 'role').getFullName()]: instance => instance.value.id && `${baseURL}/privilege_groups/${instance.value.id}/edit`,
  [new ElemID(WORKATO, 'api_collection').getFullName()]: getApiCollectionUrl,
  [new ElemID(WORKATO, 'api_endpoint').getFullName()]: instance => {
    const base = instance.value.api_collection_id?.value
      && getApiCollectionUrl(instance.value.api_collection_id.value)
    return instance.value.id && base && `${base}/${instance.value.id}`
  },
  [new ElemID(WORKATO, 'property').getFullName()]: () => `${baseURL}/account_properties`,
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async element => (await element.getType())
        .elemID.getFullName() in ID_TO_URL_GENERATOR)
      .forEach(async element => {
        const url = ID_TO_URL_GENERATOR[
          (await element.getType()).elemID.getFullName()
        ](element)

        if (url !== undefined) {
          element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = url
        }
      })
  },
})

export default filter
