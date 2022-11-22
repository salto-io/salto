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
  BuiltinTypes, CORE_ANNOTATIONS, Element,
  ElemID,
  InstanceElement,
  isObjectType,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ARTICLE_TRANSLATION_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/guide_create_element_translations'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'

describe('guid create translations filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'|'preDeploy'>
  let filter: FilterType
  let mockGet: jest.SpyInstance

  const config = { ...DEFAULT_CONFIG }

  const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) })
  const articleTranslationType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME) })

  const newType = new ObjectType({
    elemID: articleTranslationType.elemID,
    fields: {
      locale: { refType: BuiltinTypes.STRING },
      html_url: { refType: BuiltinTypes.STRING },
      title: { refType: BuiltinTypes.STRING },
      body: { refType: BuiltinTypes.STRING },
      outdated: { refType: BuiltinTypes.BOOLEAN },
      draft: { refType: BuiltinTypes.BOOLEAN },
      hidden: { refType: BuiltinTypes.BOOLEAN },
      created_at: { refType: BuiltinTypes.STRING },
      updated_at: { refType: BuiltinTypes.STRING },
      created_by_id: { refType: BuiltinTypes.NUMBER },
      updated_by_id: { refType: BuiltinTypes.NUMBER }, // doesnt exist in article element
      brand: { refType: BuiltinTypes.NUMBER },
    },
    path: [ZENDESK, 'Types', ARTICLE_TRANSLATION_TYPE_NAME],
  })

  const articleDefaultInstance = new InstanceElement(
    'instance',
    articleType,
    {
      id: 123,
      locale: 'en',
      source_locale: 'en',
    }
  )

  const articleInstance = new InstanceElement(
    'instance',
    articleType,
    {
      id: 123,
      locale: 'he',
      source_locale: 'en',
    }
  )


  beforeEach(async () => {
    config[FETCH_CONFIG].enableGuide = true
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(createFilterCreatorParams({ config, client })) as FilterType
  })

  describe('onFetch', () => {
    it('should create article translations correctly', async () => {
      const newArticle = new InstanceElement(
        'instance',
        articleType,
        {
          id: 123,
          locale: 'en',
          source_locale: 'en',
          translations: [],
        }
      )
      const articleTranslationInstanceEn = new InstanceElement(
        'instance_en',
        newType,
        {
          locale: 'en',
        }
      )
      const articleTranslationInstanceHe = new InstanceElement(
        'instance_he',
        newType,
        {
          locale: 'he',
        }
      )
      articleTranslationInstanceEn.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(newArticle.elemID, newArticle),
      ]
      articleTranslationInstanceHe.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(newArticle.elemID, newArticle),
      ]
      newArticle.value.translations.push(
        new ReferenceExpression(articleTranslationInstanceEn.elemID, articleTranslationInstanceEn),
      )
      newArticle.value.translations.push(
        new ReferenceExpression(articleTranslationInstanceHe.elemID, articleTranslationInstanceHe),
      )

      const elements = [
        articleDefaultInstance,
        articleInstance,
        articleTranslationType,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      const type = elements.find(isObjectType)
      expect(type).toEqual(newType)
      expect(elements.map(e => e.elemID.typeName))
        .toEqual([
          ARTICLE_TYPE_NAME,
          ARTICLE_TRANSLATION_TYPE_NAME,
          ARTICLE_TRANSLATION_TYPE_NAME,
          ARTICLE_TRANSLATION_TYPE_NAME,
        ])
      expect(elements.sort()).toEqual([
        newArticle,
        newType,
        articleTranslationInstanceEn,
        articleTranslationInstanceHe,
      ])
    })
    it('should do nothing if id does not exist', async () => {
      const newArticle = new InstanceElement(
        'instance',
        articleType,
        {
          locale: 'en',
          source_locale: 'en',
          translations: [],
        }
      )
      const articleTranslationInstanceEn = new InstanceElement(
        'instance',
        articleTranslationType,
        {
          locale: 'en',
        }
      )

      articleTranslationInstanceEn.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(newArticle.elemID, newArticle),
      ]

      newArticle.value.translations.push(
        new ReferenceExpression(articleTranslationInstanceEn.elemID, articleTranslationInstanceEn),
      )


      const elements = [
        newArticle,
        articleTranslationType,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements).toEqual([
        newArticle,
        newType,
      ])
    })
    it('should do nothing if guide is disabled', async () => {
      config[FETCH_CONFIG].enableGuide = false
      filter = filterCreator(createFilterCreatorParams({ config })) as FilterType
      const elements: Element[] = [
        articleDefaultInstance,
        articleTranslationType,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements).toEqual([articleDefaultInstance, articleTranslationType])
    })
    it('should raise an error if no parent is found', async () => {
      const elements = [articleInstance, articleTranslationType].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.typeName))
        .toEqual([ARTICLE_TRANSLATION_TYPE_NAME])
      expect(elements).toEqual([newType])
    })
  })
  describe('preDeploy', () => {
    it('should add id to translation on deletion', async () => {
      const articleTranslationInstanceEn = new InstanceElement(
        'instance',
        articleTranslationType,
        {
          locale: 'en',
        }
      )
      const preDeployArticleTranslationInstanceEn = new InstanceElement(
        'instance',
        articleTranslationType,
        {
          id: 2,
          locale: 'en',
        }
      )
      articleTranslationInstanceEn.annotations[CORE_ANNOTATIONS.PARENT] = [
        articleDefaultInstance.value,
      ]
      preDeployArticleTranslationInstanceEn.annotations[CORE_ANNOTATIONS.PARENT] = [
        articleDefaultInstance.value,
      ]
      const clonedTranslation = articleTranslationInstanceEn.clone()
      mockGet = jest.spyOn(client, 'getSinglePage')
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/help_center/articles/123/translations/en') {
          return {
            status: 200,
            data: {
              translation: {
                id: 2,
              },
            },
          }
        }
        throw new Error('Err')
      })
      await filter.preDeploy([{ action: 'remove', data: { before: clonedTranslation } }])
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockGet).toHaveBeenCalledWith({
        url: '/api/v2/help_center/articles/123/translations/en',
      })
      expect(clonedTranslation).toEqual(preDeployArticleTranslationInstanceEn)
    })
    it('should do nothing if parent does not have an id', async () => {
      const articleTranslationInstanceEn = new InstanceElement(
        'instance',
        articleTranslationType,
        {
          locale: 'en',
        }
      )
      articleTranslationInstanceEn.annotations[CORE_ANNOTATIONS.PARENT] = []

      const clonedTranslation = articleTranslationInstanceEn.clone()
      await filter.preDeploy([{ action: 'remove', data: { before: clonedTranslation } }])
      expect(clonedTranslation).toEqual(articleTranslationInstanceEn)
    })
    it('should do nothing if response is not correct', async () => {
      const articleTranslationInstanceEn = new InstanceElement(
        'instance',
        articleTranslationType,
        {
          locale: 'en',
        }
      )
      articleTranslationInstanceEn.annotations[CORE_ANNOTATIONS.PARENT] = [
        articleDefaultInstance.value,
      ]
      const clonedTranslation = articleTranslationInstanceEn.clone()
      mockGet = jest.spyOn(client, 'getSinglePage')
      mockGet.mockImplementation(params => {
        if (params.url === '/api/v2/help_center/articles/123/translations/en') {
          return {
            status: 200,
            data: {
              translation: {
              },
            },
          }
        }
        throw new Error('Err')
      })
      await filter.preDeploy([{ action: 'remove', data: { before: clonedTranslation } }])
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockGet).toHaveBeenCalledWith({
        url: '/api/v2/help_center/articles/123/translations/en',
      })
      expect(clonedTranslation).toEqual(articleTranslationInstanceEn)
    })
  })
})
