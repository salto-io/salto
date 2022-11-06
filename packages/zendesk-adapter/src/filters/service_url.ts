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
import { filters } from '@salto-io/adapter-components'
import _ from 'lodash'
import {
  Element, isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterContext, GUIDE_BRAND_SPECIFIC_TYPES } from '../config'
import { FilterCreator, FilterResult } from '../filter'
import ZendeskClient from '../client/client'

const filter: FilterCreator = params => {
  const commonFilter = filters.serviceUrlFilterCreator<ZendeskClient, FilterContext, FilterResult>(
    params.client.getUrl().href
  )(params)
  return {
    onFetch: async (elements: Element[]): Promise<void> => {
      const brandList = elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === 'brand')
        .map(brand => brand.value)
      const brandToUrl: Record<number, string> = _.mapValues(_.keyBy(brandList, 'id'), 'brand_url')
      elements
        .filter(isInstanceElement)
        .forEach(instance => {
          let baseUrl = ''
          if (Object.keys(GUIDE_BRAND_SPECIFIC_TYPES).includes(instance.elemID.typeName)) {
            baseUrl = brandToUrl[instance.value.brand.value.value.id]
          } else {
            baseUrl = params.client.getUrl().href
          }
          filters.addUrlToInstance(instance, baseUrl, params.config)
        })
    },
    onDeploy: commonFilter.onDeploy,
  }
}
export default filter
