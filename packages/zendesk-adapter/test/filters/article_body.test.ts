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
import { ElemID, InstanceElement, ObjectType,
  BuiltinTypes, toChange, isInstanceElement, TemplateExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/article_body'
import { ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'

describe('article body filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType

  beforeAll(() => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      brand_url: { refType: BuiltinTypes.STRING },
    },
  })
  const articleType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const articleTranslationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'article_translation'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      body: { refType: BuiltinTypes.STRING },
    },
  })

  const brandInstance = new InstanceElement(
    'brand1',
    brandType,
    // eslint-disable-next-line no-template-curly-in-string
    { id: 7777, brand_url: 'https://coolSubdomain.zendesk.com' },
  )
  const brandInstance2 = new InstanceElement(
    'brand2',
    brandType,
    // eslint-disable-next-line no-template-curly-in-string
    { id: 7778, brand_url: 'https://anotherDomain.notZendesk.smith' },
  )
  const articleInstance = new InstanceElement(
    'refArticle',
    articleType,
    // eslint-disable-next-line no-template-curly-in-string
    { id: 1666 },
  )
  const templatedTranslationInstance = new InstanceElement(
    'templatedTranslation',
    articleTranslationType,
    // eslint-disable-next-line no-template-curly-in-string
    { id: 1003, body: '<p><a href="https://coolSubdomain.zendesk.com/hc/en-us/articles/1666" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://coolSubdomain.zendesk.com/hc/he/articles/1666' },
  )
  const partialTemplatedTranslationInstance = new InstanceElement(
    'partialTemplatedTranslation',
    articleTranslationType,
    // eslint-disable-next-line no-template-curly-in-string
    { id: 1004, body: '<a href="https://anotherDomain.notZendesk.smith/hc/en-us/nonarticles/1666" target="_self">linkedArticle</a>' },
  )

  const articleIdWithStringTranslation = new InstanceElement(
    'articleIdWithStringTranslation',
    articleTranslationType,
    // eslint-disable-next-line no-template-curly-in-string
    { id: 1005, body: '<a href="https://coolSubdomain.zendesk.com/hc/en-us/articles/1666-someString" target="_self">linkedArticle</a>' },
  )


  const generateElements = (): (InstanceElement | ObjectType)[] => ([
    brandInstance,
    brandInstance2,
    articleInstance,
    templatedTranslationInstance,
    partialTemplatedTranslationInstance,
    articleIdWithStringTranslation,
  ]).map(element => element.clone())

  describe('on fetch', () => {
    let elements: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })


    it('should add templates correctly', () => {
      const fetchedTranslation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'templatedTranslation')
      // eslint-disable-next-line no-template-curly-in-string
      expect(fetchedTranslation?.value.body).toEqual(new TemplateExpression({ parts: [
        '<p><a href="',
        new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
        '/hc/en-us/articles/',
        new ReferenceExpression(articleInstance.elemID, articleInstance),
        '" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="',
        new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
        '/hc/he/articles/',
        new ReferenceExpression(articleInstance.elemID, articleInstance),
      ] }))
    })
    it('should add partial templates normally', () => {
      const fetchedTranslation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'partialTemplatedTranslation')
      expect(fetchedTranslation?.value.body).toEqual(new TemplateExpression({
        parts: [
          '<a href="',
          new ReferenceExpression(brandInstance2.elemID.createNestedID('brand_url'), brandInstance2.value.brand_url),
          '/hc/en-us/nonarticles/1666" target="_self">linkedArticle</a>',
        ],
      }))
    })
    it('should keep url parts after articleId', () => {
      const fetchedTranslation = elements.filter(isInstanceElement).find(i => i.elemID.name === 'articleIdWithStringTranslation')
      expect(fetchedTranslation?.value.body).toEqual(new TemplateExpression({
        parts: [
          '<a href="',
          new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
          '/hc/en-us/articles/',
          new ReferenceExpression(articleInstance.elemID, articleInstance),
          '-someString" target="_self">linkedArticle</a>',
        ],
      }))
    })
  })
  describe('preDeploy', () => {
    let elementsBeforeFetch: (InstanceElement | ObjectType)[]
    let elementsAfterPreDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      elementsBeforeFetch = generateElements()
      const elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to origin after predeploy', () => {
      expect(elementsAfterPreDeploy).toEqual(elementsBeforeFetch)
    })
  })

  describe('onDeploy', () => {
    let elementsAfterFetch: (InstanceElement | ObjectType)[]
    let elementsAfterOnDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      // we recreate feth and onDeploy to have the templates in place to be restored by onDeploy
      const elementsBeforeFetch = generateElements()
      elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      elementsAfterOnDeploy = elementsAfterPreDeploy.map(e => e.clone())
      await filter.onDeploy(elementsAfterOnDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to after fetch state (with templates) after onDeploy', () => {
      expect(elementsAfterOnDeploy).toEqual(elementsAfterFetch)
    })
  })
})
