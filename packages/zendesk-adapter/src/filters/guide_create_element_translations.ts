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
  BuiltinTypes, Change, CORE_ANNOTATIONS,
  Element,
  ElemID, getChangeData,
  InstanceElement,
  isInstanceElement, isObjectType, isRemovalChange,
  ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { ARTICLE_TRANSLATION_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../constants'

const log = logger(module)

type ArticleTranslationResponse = {
  translation: {
    id: number
  }
}

const EXPECTED_TRANSLATION_SCHEMA = Joi.object({
  translation: Joi.object({
    id: Joi.number().required(),
  }).unknown(true).required(),
}).required()

const isArticleTranslationResponse = createSchemeGuard<ArticleTranslationResponse>(
  EXPECTED_TRANSLATION_SCHEMA, 'Received invalid article translation result'
)

const isExtraArticle = (parentInstance: Element): boolean =>
  isInstanceElement(parentInstance)
  && (parentInstance.elemID.typeName === ARTICLE_TYPE_NAME)
  && (parentInstance.value.locale !== parentInstance.value.source_locale)

const isTranslationType = (elem: Element): boolean =>
  isObjectType(elem)
  && (elem.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)

const createTranslationType = () :ObjectType => new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME),
  fields: {
    // can't get id
    locale: { refType: BuiltinTypes.STRING },
    title: { refType: BuiltinTypes.STRING },
    body: { refType: BuiltinTypes.STRING },
    outdated: { refType: BuiltinTypes.BOOLEAN },
    draft: { refType: BuiltinTypes.BOOLEAN },
    hidden: { refType: BuiltinTypes.BOOLEAN }, // doesnt exist in article element
    created_by_id: { refType: BuiltinTypes.NUMBER }, // doesnt exist in article element
    updated_by_id: { refType: BuiltinTypes.NUMBER }, // doesnt exist in article element
    brand: { refType: BuiltinTypes.NUMBER },
  },
})


const filterCreator: FilterCreator = ({ config, client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    if (!config.fetch.enableGuide) {
      return
    }
    _.remove(elements, isTranslationType)
    const articleTranslationType = createTranslationType()
    elements.push(articleTranslationType)

    const articles = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
      .filter(instance => instance.value.id !== undefined)

    const groupedById = _.groupBy(articles, 'value.id')

    articles
      .filter(parentInstance => parentInstance.value.locale === parentInstance.value.source_locale)
      .forEach(instance => { instance.value.translations = [] })
    articles
      .forEach(instance => {
        const articleTranslationInstance = new InstanceElement(
          instance.elemID.name,
          articleTranslationType,
          {
            locale: instance.value.locale,
            title: instance.value.title,
            body: instance.value.body,
            outdated: instance.value.outdated,
            brand: instance.value.brand,
          },
        )
        const parent = groupedById[instance.value.id]
          .find(
            parentInstance => parentInstance.value.locale === parentInstance.value.source_locale
          )
        if (parent === undefined) {
          log.error('could not find article translation parent')
          return
        }
        parent.value.translations.push(
          new ReferenceExpression(articleTranslationInstance.elemID, articleTranslationInstance)
        )
        articleTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
          new ReferenceExpression(parent.elemID, parent),
        ]
        elements.push(articleTranslationInstance)
      })
    _.remove(elements, isExtraArticle)
    // const groupedById = _.groupBy(articles, 'value.id')
  },
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    const relaventChanges = changes
      .filter(isRemovalChange)
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)

    relaventChanges
      .forEach(async change => {
        // parent is an object
        const parentId = getChangeData(change).annotations[CORE_ANNOTATIONS.PARENT][0].id
        const { locale } = getChangeData(change).value
        if (parentId === undefined || locale === undefined) {
          log.error('could not find article translation parent or locale')
          return
        }
        const response = await client.getSinglePage({
          url: `/api/v2/help_center/articles/${parentId}/translations/${locale}`,
        })
        if (!isArticleTranslationResponse(response.data)) {
          log.error('Failed to get the article traslation')
          return
        }
        getChangeData(change).value.id = response.data.translation.id
      })
  },
})
export default filterCreator
