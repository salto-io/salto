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
import _ from 'lodash'
import {
  InstanceElement, isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { ARTICLE_TYPE_NAME, BRAND_TYPE_NAME } from '../constants'

const ARTICLE_TYPES = [ARTICLE_TYPE_NAME, 'article_translation']
const BODY_FIELD = 'body'

const ARTICLE_REF_URL_REGEX = /(https:\/\/.*\.zendesk\.com\/hc\/.*\/articles\/\d*)/g
const BASE_URL_REGEX = /(https:\/\/.*\.zendesk\.com)/

const referenceArticleUrl = (articleUrl: string, brandInstances: InstanceElement[]): string => {
  const brand = brandInstances
    .find(brandInstance => brandInstance.value.brand_url === articleUrl.match(BASE_URL_REGEX))
  return `\${${brand?.elemID.getFullName()}}/hc...`
}

const updateArticleBody = (
  articleInstace: InstanceElement,
  brandInstances: InstanceElement[],
): void => {
  const originalArticleBody = articleInstace.value[BODY_FIELD]
  if (!_.isString(originalArticleBody)) {
    return
  }
  const processedArticleBody = originalArticleBody.replaceAll(
    ARTICLE_REF_URL_REGEX,
    articleUrl => referenceArticleUrl(articleUrl, brandInstances),
  )
  articleInstace.value.body = processedArticleBody
}

/**
 * Process body value in article instances to reference other objects
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async elements => {
    const brandInstances = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)
    elements
      .filter(isInstanceElement)
      .filter(instance => ARTICLE_TYPES.includes(instance.elemID.typeName))
      .filter(articleInstance => !_.isEmpty(articleInstance.value[BODY_FIELD]))
      .forEach(articleInstance => updateArticleBody(articleInstance, brandInstances))
  },
})

export default filterCreator
