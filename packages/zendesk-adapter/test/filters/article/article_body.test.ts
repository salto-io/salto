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
import filterCreator from '../../../src/filters/article/article_body'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../../../src/constants'
import { createFilterCreatorParams } from '../../utils'

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

  const createObjectType = (typeName: string): ObjectType => new ObjectType({
    elemID: new ElemID(ZENDESK, typeName),
    fields: { id: { refType: BuiltinTypes.NUMBER } },
  })
  const articleType = createObjectType(ARTICLE_TYPE_NAME)
  const sectionType = createObjectType(SECTION_TYPE_NAME)
  const categoryType = createObjectType(CATEGORY_TYPE_NAME)
  const attachmentType = createObjectType(ARTICLE_ATTACHMENT_TYPE_NAME)

  const articleTranslationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'article_translation'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      body: { refType: BuiltinTypes.STRING },
    },
  })

  const brandInstance = new InstanceElement(
    'brand',
    brandType,
    { id: 1, brand_url: 'https://brand.zendesk.com' },
  )

  const emptyBrandInstance = new InstanceElement(
    'brand2',
    brandType,
    { id: 2, brand_url: 'https://brand2.zendesk.com' },
  )

  const createInstanceElement = (type: ObjectType): InstanceElement =>
    new InstanceElement(
      type.elemID.name,
      type,
      { id: 123, brand: new ReferenceExpression(brandInstance.elemID, brandInstance) }
    )

  const articleInstance = createInstanceElement(articleType)
  const sectionInstance = createInstanceElement(sectionType)
  const categoryInstance = createInstanceElement(categoryType)
  const attachmentInstance = createInstanceElement(attachmentType)
  // To test that the code catches both brand as id and brand as reference expression
  attachmentInstance.value.brand = brandInstance.value.id

  const translationWithReferences = new InstanceElement(
    'translationWithReferences',
    articleTranslationType,
    { id: 1, body: '<p><a href="https://brand.zendesk.com/hc/en-us/articles/123/sep/sections/123/sep/categories/123/sep/article_attachments/123-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://brand.zendesk.com/hc/he/articles/123-extra_string"' },
  )

  const translationWithEmptyBrand = new InstanceElement(
    'translationWithEmptyBrand',
    articleTranslationType,
    { id: 1, body: '<p><a href="https://brand2.zendesk.com/hc/en-us/articles/124/sep/sections/123/sep/categories/123/sep/article_attachments/123-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://brand.zendesk.com/hc/he/articles/123-extra_string"' },
  )

  const translationWithoutReferences = new InstanceElement(
    'translationWithoutReferences',
    articleTranslationType,
    { id: 1, body: '<p><a href="https://nobrand.zendesk.com/hc/en-us/articles/124/sep/sections/124/sep/categories/124/sep/article_attachments/124-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://nobrand.zendesk.com/hc/he/articles/124-extra_string"' },
  )

  const translationWithAttachments = new InstanceElement(
    'articleWithAttachments',
    articleTranslationType,
    { id: 1005, body: '<p><img src="https://brand.zendesk.com/hc/article_attachments/123" alt="alttext"><img src="https://brand.zendesk.com/hc/article_attachments/123" alt="alttext"></p>' },
  )

  const generateElements = (): (InstanceElement | ObjectType)[] => ([
    brandInstance,
    emptyBrandInstance,
    articleInstance,
    sectionInstance,
    categoryInstance,
    attachmentInstance,
    translationWithReferences,
    translationWithEmptyBrand,
    translationWithoutReferences,
    translationWithAttachments,
  ]).map(element => element.clone())

  describe('on fetch', () => {
    let elements: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should convert all possible urls to references', () => {
      const fetchedTranslationWithReferences = elements.filter(isInstanceElement).find(i => i.elemID.name === 'translationWithReferences')
      expect(fetchedTranslationWithReferences?.value.body).toEqual(new TemplateExpression({ parts: [
        '<p><a href="',
        new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
        '/hc/en-us/articles/', new ReferenceExpression(articleInstance.elemID, articleInstance),
        '/sep/sections/', new ReferenceExpression(sectionInstance.elemID, sectionInstance),
        '/sep/categories/', new ReferenceExpression(categoryInstance.elemID, categoryInstance),
        '/sep/article_attachments/', new ReferenceExpression(attachmentInstance.elemID, attachmentInstance),
        '-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="',
        new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
        '/hc/he/articles/', new ReferenceExpression(articleInstance.elemID, articleInstance),
        '-extra_string"',
      ] }))
    })
    it('should only match elements that exists in the matched brand', () => {
      const fetchedTranslationWithoutReferences = elements.filter(isInstanceElement).find(i => i.elemID.name === 'translationWithEmptyBrand')
      expect(fetchedTranslationWithoutReferences?.value.body)
        .toEqual(new TemplateExpression({ parts: [
          '<p><a href="',
          new ReferenceExpression(emptyBrandInstance.elemID.createNestedID('brand_url'), emptyBrandInstance.value.brand_url),
          '/hc/en-us/articles/124/sep/sections/123/sep/categories/123/sep/article_attachments/123-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="',
          new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
          '/hc/he/articles/', new ReferenceExpression(articleInstance.elemID, articleInstance),
          '-extra_string"',
        ] }))
    })
    it('should do nothing if elements do not exists', () => {
      const fetchedTranslationWithoutReferences = elements.filter(isInstanceElement).find(i => i.elemID.name === 'translationWithoutReferences')
      expect(fetchedTranslationWithoutReferences?.value.body)
        .toEqual('<p><a href="https://nobrand.zendesk.com/hc/en-us/articles/124/sep/sections/124/sep/categories/124/sep/article_attachments/124-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://nobrand.zendesk.com/hc/he/articles/124-extra_string"')
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
