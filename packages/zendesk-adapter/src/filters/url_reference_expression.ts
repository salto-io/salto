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

import { isInstanceElement, ReferenceExpression, TemplateExpression } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME, ZENDESK } from '../constants'
import { FETCH_CONFIG, ZendeskConfig } from '../config'
import { createMissingInstance } from './references/missing_references'

const urlRegex = /(?<brandUrl>.+.com)(?<path>.+\/)(?<id>\d+)(?<suffix>.+)/

const createMissingBrand = (
  { brandUrl, config }: { brandUrl: string; config: ZendeskConfig }
): ReferenceExpression | string => {
  if (config[FETCH_CONFIG].enableMissingReferences) {
    const missingBrand = createMissingInstance(ZENDESK, BRAND_TYPE_NAME, brandUrl)
    return new ReferenceExpression(missingBrand.elemID, missingBrand)
  }
  return brandUrl
}

/**
 * Updates element's url to reference expressions of the brand and the instance
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'urlReferenceExpression',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const brands = instances.filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)

    instances.forEach(instance => {
      const { url } = instance.value
      // url is usually omitted, if it's not - we need to try and update it
      if (!url) {
        return
      }
      const { brandUrl, path, id, suffix } = url.match(urlRegex)?.groups ?? {}
      // Don't do anything if the url doesn't match the expected format
      if (!brandUrl || !path || !id) {
        return
      }
      const brandInstance = brands.find(brand => brand.value.brand_url === brandUrl)

      // Replace the brand and the instance id with reference expressions
      instance.value.url = new TemplateExpression({
        parts: [
          brandInstance
            ? new ReferenceExpression(brandInstance.elemID, brandInstance)
            : createMissingBrand({ brandUrl, config }),
          path,
          new ReferenceExpression(instance.elemID, instance),
          suffix,
        ],
      })
    })
  },
})

export default filterCreator
