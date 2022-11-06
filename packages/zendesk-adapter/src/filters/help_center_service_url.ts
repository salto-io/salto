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
import {
  CORE_ANNOTATIONS,
  Element,
  InstanceElement,
  isInstanceElement,
  isPrimitiveValue,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME, BRAND_TYPE_NAME,
} from '../constants'

const PARAM_MATCH = /\{([\w_.]+)}/g
const DIFFERENT_BASE_URL_TYPES = [CATEGORY_TRANSLATION_TYPE_NAME, GUIDE_SETTINGS_TYPE_NAME]
const SERVICE_URL_FOR_GUIDE: Record<string, string> = {
  [SECTION_TYPE_NAME]: '/knowledge/arrange/sections/{id}?brand_id={brand}',
  [CATEGORY_TYPE_NAME]: '/knowledge/arrange/categories/{id}?brand_id={brand}',
  [ARTICLE_TYPE_NAME]: '/knowledge/articles/{id}/{source_locale}?brand_id={brand}',
  [ARTICLE_TRANSLATION_TYPE_NAME]: '/knowledge/articles/{_parent.0.value.value.id}/{locale}?brand_id={brand}',
  [SECTION_TRANSLATION_TYPE_NAME]: '/knowledge/sections/{_parent.0.value.value.id}?brand_id={brand}&locale={locale}',
  [CATEGORY_TRANSLATION_TYPE_NAME]: '/hc/admin/categories/{_parent.0.value.value.id}/edit?translation_locale={locale}',
  [GUIDE_SETTINGS_TYPE_NAME]: '/hc/admin/general_settings',
}

const replaceUrlParamsBrand = (url: string, instance: InstanceElement): string =>
  url.replace(
    PARAM_MATCH,
    val => {
      let replacement
      if (val.slice(1, -1).startsWith('_')) {
        replacement = _.get(instance.annotations, val.slice(1, -1)) ?? val
      } else {
        replacement = instance.value[val.slice(1, -1)] ?? val
      }
      if (!isPrimitiveValue(replacement)) {
        throw new Error(`Cannot replace param ${val} in ${url} with non-primitive value ${replacement}`)
      }
      return replacement.toString()
    }
  )

const createServiceUrl = (instance: InstanceElement, baseUrl:string): void => {
  const url = replaceUrlParamsBrand(SERVICE_URL_FOR_GUIDE[instance.elemID.typeName], instance)
  instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = (new URL(url, baseUrl)).href
}

const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const brandList = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
      .map(brand => brand.value)
    const brandToUrl: Record<number, string> = _.mapValues(_.keyBy(brandList, 'id'), 'brand_url')

    elements
      .filter(isInstanceElement)
      .filter(instance => Object.keys(SERVICE_URL_FOR_GUIDE).includes(instance.elemID.typeName))
      .forEach(instance => {
        let baseUrl
        if (DIFFERENT_BASE_URL_TYPES.includes(instance.elemID.typeName)) {
          baseUrl = brandToUrl[instance.value.brand]
        } else {
          baseUrl = client.getUrl().href
        }
        createServiceUrl(instance, baseUrl)
      })
  },
})
export default filterCreator
