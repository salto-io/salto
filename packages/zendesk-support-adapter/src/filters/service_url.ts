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
import { CORE_ANNOTATIONS, Element, isInstanceElement } from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'

const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async (elements: Element[]) => {
    const baseUrl = client.getUrl().href
    elements
      .filter(isInstanceElement)
      .forEach(instance => {
        const serviceUrlConfig = config[API_DEFINITIONS_CONFIG]
          .types[instance.elemID.typeName]?.transformation?.serviceUrl
        if (serviceUrlConfig === undefined) {
          return
        }
        const url = elementsUtils.createUrl({
          instance,
          baseUrl: serviceUrlConfig.url,
          urlParamsToFields: serviceUrlConfig.urlParamsToFields,
        })
        instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = (new URL(url, baseUrl)).href
      })
  },
})

export default filter
