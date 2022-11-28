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
import { elements as elementsUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { ARTICLE_TRANSLATION_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../constants'

const log = logger(module)

const areLocalesEqual = (instance: InstanceElement): boolean =>
  // locale and source_locale should not be reference expressions yet
  _.isEqual(instance.value.locale, instance.value.source_locale)

type ArticleTranslationResponse = {
  translation: {
    id: number
  }
}

export const EXPECTED_TRANSLATION_SCHEMA = Joi.object({
  translation: Joi.object({
    id: Joi.number().required(),
  }).unknown(true).required(),
}).required()

const isArticleTranslationResponse = createSchemeGuard<ArticleTranslationResponse>(
  EXPECTED_TRANSLATION_SCHEMA, 'Received invalid article translation result'
)

/**
 * checks if the article represents a different translation than the source_locale
 */
const isTranslationRepresentingArticle = (parentInstance: Element): boolean => (
  isInstanceElement(parentInstance)
  && (parentInstance.elemID.typeName === ARTICLE_TYPE_NAME)
  && (!areLocalesEqual(parentInstance))
)

const isTranslationType = (elem: Element): boolean =>
  isObjectType(elem)
  && (elem.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)

const createTranslationType = () :ObjectType => new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME),
  fields: {
    // can't get id since translation is deduced from the article instance and the id is the article's
    locale: { refType: BuiltinTypes.STRING },
    html_url: { refType: BuiltinTypes.STRING },
    title: { refType: BuiltinTypes.STRING },
    body: { refType: BuiltinTypes.STRING },
    outdated: { refType: BuiltinTypes.BOOLEAN },
    draft: { refType: BuiltinTypes.BOOLEAN },
    hidden: { refType: BuiltinTypes.BOOLEAN }, // doesnt exist in article element
    created_at: { refType: BuiltinTypes.STRING },
    updated_at: { refType: BuiltinTypes.STRING },
    created_by_id: { refType: BuiltinTypes.NUMBER }, // doesnt exist in article element
    updated_by_id: { refType: BuiltinTypes.NUMBER }, // doesnt exist in article element
    brand: { refType: BuiltinTypes.NUMBER },
  },
  path: [ZENDESK, elementsUtils.TYPES_PATH, ARTICLE_TRANSLATION_TYPE_NAME],
})


/**
 * On fetch, this filter creates article_translation instances from article instances. This is done in order to reduce
 * the number of API calls. In preDeploy, only for removal changes, since the article_translation instances don't have
 * an internal id, and it is needed for deletion, the filter acquires the id of the translation.
 */
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
      .filter(instance => {
        if (instance.value.id === undefined) {
          log.error(`article instance ${instance.elemID.name} does not have an id field`)
          return false
        }
        return true
      })

    const defaultTranslationArticlesById = _.keyBy(articles.filter(inst => !isTranslationRepresentingArticle(inst)), 'value.id')

    const createTranslation = (instance: InstanceElement): InstanceElement | undefined => {
      const parent = defaultTranslationArticlesById[instance.value.id]
      if (parent === undefined) {
        log.error(`could not find article translation parent for article id ${instance.value.id}: ${instance.value.title}`)
        return undefined
      }
      return new InstanceElement(
        `${instance.elemID.name}_${instance.value.locale}`,
        articleTranslationType,
        {
          html_url: instance.value.html_url,
          locale: instance.value.locale,
          title: instance.value.title,
          body: instance.value.body,
          draft: instance.value.draft,
          created_at: instance.value.created_at,
          updated_at: instance.value.updated_at,
          outdated: instance.value.outdated,
          brand: instance.value.brand,
        },
        undefined, // path will be set later
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
      )
    }

    const articlesById = _.groupBy(articles, 'value.id')
    const translationsById = _.mapValues(
      articlesById,
      instances => instances.map(createTranslation).filter(values.isDefined)
    )

    Object.entries(translationsById).forEach(([articleId, translations]) => {
      const parentArticle = defaultTranslationArticlesById[articleId]
      if (parentArticle === undefined) {
        // already logged earlier
        return
      }
      parentArticle.value.translations = translations.map(
        translation => new ReferenceExpression(translation.elemID, translation)
      )
      elements.push(...translations)
    })
    _.remove(elements, isTranslationRepresentingArticle)
  },
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    const relaventChanges = changes
      .filter(isRemovalChange)
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)

    relaventChanges
      .forEach(async change => {
        // parent is an object
        const parentId = getChangeData(change).annotations[CORE_ANNOTATIONS.PARENT][0]?.id
        const { locale } = getChangeData(change).value
        if (parentId === undefined || locale === undefined) {
          log.error(
            `could not find article translation parent or locale for article translation ${getChangeData(change).elemID.name}`
          )
          return
        }
        const response = await client.getSinglePage({
          url: `/api/v2/help_center/articles/${parentId}/translations/${locale}`,
        })
        if (!isArticleTranslationResponse(response.data)) {
          log.error(`Failed to get data from the service for article translation ${getChangeData(change).elemID.name}`)
          return
        }
        getChangeData(change).value.id = response.data.translation.id
      })
  },
})
export default filterCreator
