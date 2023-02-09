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
  GUIDE_SETTINGS_TYPE_NAME, BRAND_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
} from '../constants'

const PARAM_MATCH = /\{([\w_.]+)}/g
const BRAND_SPECIFIC_BASE_URL_TYPES = [
  CATEGORY_TRANSLATION_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
]
const SERVICE_URL_FOR_GUIDE: Record<string, string> = {
  [SECTION_TYPE_NAME]: '/knowledge/arrange/sections/{id}?brand_id={brand}',
  [CATEGORY_TYPE_NAME]: '/knowledge/arrange/categories/{id}?brand_id={brand}',
  [ARTICLE_TYPE_NAME]: '/knowledge/articles/{id}/{source_locale}?brand_id={brand}',
  [ARTICLE_TRANSLATION_TYPE_NAME]: '/knowledge/articles/{_parent.0.value.value.id}/{locale}?brand_id={brand}',
  [SECTION_TRANSLATION_TYPE_NAME]: '/knowledge/sections/{_parent.0.value.value.id}?brand_id={brand}&locale={locale}',
  [CATEGORY_TRANSLATION_TYPE_NAME]: '/hc/admin/categories/{_parent.0.value.value.id}/edit?translation_locale={locale}',
  [GUIDE_SETTINGS_TYPE_NAME]: '/hc/admin/general_settings',
  [GUIDE_LANGUAGE_SETTINGS_TYPE_NAME]: '/hc/admin/language_settings',
}

const replaceUrlParamsBrand = (url: string, instance: InstanceElement): string =>
  url.replace(
    PARAM_MATCH,
    val => {
      let replacement
      if (val.slice(1, -1).startsWith('_')) { // meaning that it refers to an annotation
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

/**
 * this filter creates the serviceUrl annotation for guide elements. It first determines the baseUrl
 * (category_translation and guide_settings have different ones depending on the brand). Then the
 * filter replaces url params and creates the service url accordingly.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  name: 'guideServiceUrl',
  onFetch: async (elements: Element[]): Promise<void> => {
    const brandList = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
      .map(brand => brand.value)
    const brandToUrl: Record<number, string> = _.mapValues(_.keyBy(brandList, 'id'), 'brand_url')

    const toBaseUrl = (instance: InstanceElement): string => {
      // only some have different baseUrl according to brand
      if (BRAND_SPECIFIC_BASE_URL_TYPES.includes(instance.elemID.typeName)) {
        return brandToUrl[instance.value.brand]
      }
      return client.getUrl().href
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => Object.keys(SERVICE_URL_FOR_GUIDE).includes(instance.elemID.typeName))
      .forEach(instance => {
        createServiceUrl(instance, toBaseUrl(instance))
      })
  },
})
export default filterCreator
