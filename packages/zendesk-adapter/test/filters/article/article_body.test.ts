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
import { ElemID, InstanceElement, ObjectType,
  BuiltinTypes, toChange, isInstanceElement, TemplateExpression, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../../src/filters/article/article_body'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_ATTACHMENTS_FIELD,
  ARTICLE_TYPE_NAME,
  ARTICLES_FIELD,
  BRAND_TYPE_NAME, CATEGORIES_FIELD,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME, SECTIONS_FIELD,
  ZENDESK,
} from '../../../src/constants'
import { createFilterCreatorParams } from '../../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../../src/config'
import { createMissingInstance } from '../../../src/filters/references/missing_references'
import { FilterResult } from '../../../src/filter'

describe('article body filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy', FilterResult>
  let filter: FilterType
  const config = { ...DEFAULT_CONFIG }

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      brand_url: { refType: BuiltinTypes.STRING },
      has_help_center: { refType: BuiltinTypes.BOOLEAN },
      name: { refType: BuiltinTypes.STRING },
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
    { id: 1, brand_url: 'https://brand.zendesk.com', name: 'brand', has_help_center: true, subdomain: 'brandSub' },
  )

  const brandToExclude = new InstanceElement(
    'excluded',
    brandType,
    { id: 1, brand_url: 'https://excluded.zendesk.com', name: 'excluded', has_help_center: true, subdomain: 'excludedSub' },
  )

  const brandToExclude2 = new InstanceElement(
    'excluded2',
    brandType,
    { id: 3, brand_url: 'https://excluded2.zendesk.com', name: 'excluded2', has_help_center: true, subdomain: 'excluded2Sub' },
  )

  const emptyBrandInstance = new InstanceElement(
    'brand2',
    brandType,
    { id: 2, brand_url: 'https://brand2.zendesk.com', name: 'brand2', has_help_center: true, subdomain: 'brand2Sub' },
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

  const parentArticle = new InstanceElement('articleParent', articleType, { id: 100, name: 'ar' })
  const translationWithReferences = new InstanceElement(
    'translationWithReferences',
    articleTranslationType,
    { id: 1, body: '<p><a href="https://brand.zendesk.com/hc/en-us/articles/123/sep/sections/123/sep/categories/123/sep/article_attachments/123-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://brand.zendesk.com/hc/he/articles/123-extra_string"' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
  )

  const translationWithEmptyBrand = new InstanceElement(
    'translationWithEmptyBrand',
    articleTranslationType,
    { id: 1, body: '<p><a href="https://brand2.zendesk.com/hc/en-us/articles/124/sep/sections/123/sep/categories/123/sep/article_attachments/123-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://brand.zendesk.com/hc/he/articles/123-extra_string"' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
  )

  const translationWithoutReferences = new InstanceElement(
    'translationWithoutReferences',
    articleTranslationType,
    { id: 1, body: '<p><a href="https://nobrand.zendesk.com/hc/en-us/articles/124/sep/sections/124/sep/categories/124/sep/article_attachments/124-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://nobrand.zendesk.com/hc/he/articles/124-extra_string"' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
  )

  const translationWithAttachments = new InstanceElement(
    'articleWithAttachments',
    articleTranslationType,
    { id: 1005, body: '<p><img src="https://brand.zendesk.com/hc/article_attachments/123" alt="alttext"><img src="https://brand.zendesk.com/hc/article_attachments/123" alt="alttext"></p>' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
  )

  const articeOfExcludedBrand = new InstanceElement(
    '12321312',
    articleType,
    { id: 321, brand: new ReferenceExpression(brandToExclude.elemID, brandToExclude) }
  )
  const translationWithExcludedBrand = new InstanceElement(
    'articleWithExcludedBrand',
    articleTranslationType,
    { id: 101010, body: '<p><a href="https://excluded.zendesk.com/hc/en-us/articles/321" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
  )

  const translationWithMixedBrands = new InstanceElement(
    'articleWithMixedBrand',
    articleTranslationType,
    { id: 202020, body: '<p><a href="https://brand.zendesk.com/hc/en-us/articles/123" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
  )

  const generateElements = (): (InstanceElement | ObjectType)[] => ([
    brandInstance,
    brandToExclude,
    brandToExclude2,
    emptyBrandInstance,
    articleInstance,
    sectionInstance,
    categoryInstance,
    attachmentInstance,
    translationWithReferences,
    translationWithEmptyBrand,
    translationWithoutReferences,
    translationWithAttachments,
    translationWithExcludedBrand,
    parentArticle,
    translationWithMixedBrands,
    articeOfExcludedBrand,
  ]).map(element => element.clone())

  describe('on fetch', () => {
    let elements: (InstanceElement | ObjectType)[]

    describe('when all brands included', () => {
      beforeAll(async () => {
        config[FETCH_CONFIG].guide = { brands: ['.*'] }
        filter = filterCreator(createFilterCreatorParams({ config })) as FilterType
        elements = generateElements()
      })
      it('should convert all possible urls to references', async () => {
        const filterResult = await filter.onFetch(elements) as FilterResult
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
        expect(filterResult.errors).toHaveLength(0)
      })
      it('should only match elements that exists in the matched brand', async () => {
        const filterResult = await filter.onFetch(elements) as FilterResult
        const brandName = emptyBrandInstance.value.name
        const missingArticleInstance = createMissingInstance(ZENDESK, ARTICLES_FIELD, `${brandName}_124`)
        const missingSectionInstance = createMissingInstance(ZENDESK, SECTIONS_FIELD, `${brandName}_123`)
        const missingCategoryInstance = createMissingInstance(ZENDESK, CATEGORIES_FIELD, `${brandName}_123`)
        const missingArticleAttachmentInstance = createMissingInstance(ZENDESK, ARTICLE_ATTACHMENTS_FIELD, `${brandName}_123`)
        missingArticleInstance.value.id = '124'
        missingSectionInstance.value.id = '123'
        missingCategoryInstance.value.id = '123'
        missingArticleAttachmentInstance.value.id = '123'
        const fetchedTranslationWithoutReferences = elements.filter(isInstanceElement).find(i => i.elemID.name === 'translationWithEmptyBrand')
        expect(fetchedTranslationWithoutReferences?.value.body)
          .toEqual(new TemplateExpression({ parts: [
            '<p><a href="',
            new ReferenceExpression(emptyBrandInstance.elemID.createNestedID('brand_url'), emptyBrandInstance.value.brand_url),
            '/hc/en-us/articles/', new ReferenceExpression(missingArticleInstance.elemID, missingArticleInstance),
            '/sep/sections/', new ReferenceExpression(missingSectionInstance.elemID, missingSectionInstance),
            '/sep/categories/', new ReferenceExpression(missingCategoryInstance.elemID, missingCategoryInstance),
            '/sep/article_attachments/', new ReferenceExpression(missingArticleAttachmentInstance.elemID, missingArticleAttachmentInstance),
            '-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="',
            new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
            '/hc/he/articles/',
            new ReferenceExpression(articleInstance.elemID, articleInstance),
            '-extra_string"',
          ] }))
        expect(filterResult.errors).toHaveLength(0)
      })
      it('should do nothing if elements do not exists', async () => {
        const filterResult = await filter.onFetch(elements) as FilterResult
        const fetchedTranslationWithoutReferences = elements.filter(isInstanceElement).find(i => i.elemID.name === 'translationWithoutReferences')
        expect(fetchedTranslationWithoutReferences?.value.body)
          .toEqual('<p><a href="https://nobrand.zendesk.com/hc/en-us/articles/124/sep/sections/124/sep/categories/124/sep/article_attachments/124-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://nobrand.zendesk.com/hc/he/articles/124-extra_string"')
        expect(filterResult.errors).toHaveLength(0)
      })
    })

    describe('when some brands are excluded', () => {
      beforeAll(() => {
        config[FETCH_CONFIG].guide = { brands: ['^(?!excluded).*$'] }
        filter = filterCreator(createFilterCreatorParams({ config })) as FilterType
        elements = generateElements()
      })

      it('should not create reference for urls of excluded brands', async () => {
        const filterResult = await filter.onFetch(elements) as FilterResult
        const fetchedTranslationWithReferences = elements.filter(isInstanceElement).find(i => i.elemID.name === 'articleWithExcludedBrand')
        expect(fetchedTranslationWithReferences?.value.body)
          .toEqual('<p><a href="https://excluded.zendesk.com/hc/en-us/articles/321" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh')
        const fetchedTranslationWithReferences2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'articleWithMixedBrand')
        expect(fetchedTranslationWithReferences2?.value.body)
          .toEqual(new TemplateExpression({ parts: [
            '<p><a href="',
            new ReferenceExpression(brandInstance.elemID.createNestedID('brand_url'), brandInstance.value.brand_url),
            '/hc/en-us/articles/',
            new ReferenceExpression(articleInstance.elemID, articleInstance),
            '" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh',
          ] }))
        expect(filterResult.errors).toHaveLength(2)
        expect(filterResult.errors?.[0]).toEqual({
          message: 'Brand excluded (subdomain excludedSub) is referenced by articles, but it is not currently fetched - therefore URLs pointing to it are treated as external, and will not be modified if these articles are deployed to another environment.\nIf you would like to include this brand, please add it under fetch.guide.brands.\nThe brand is referenced from the following articles (partial list limited to 10): articleParent',
          severity: 'Warning',
        })
        expect(filterResult.errors?.[1]).toEqual({
          message: 'Brand excluded2 (subdomain excluded2Sub) is referenced by articles, but it is not currently fetched - therefore URLs pointing to it are treated as external, and will not be modified if these articles are deployed to another environment.\nIf you would like to include this brand, please add it under fetch.guide.brands.\nThe brand is referenced from the following articles (partial list limited to 10): articleParent',
          severity: 'Warning',
        })
      })
    })
  })
  describe('preDeploy', () => {
    let elementsBeforeFetch: (InstanceElement | ObjectType)[]
    let elementsAfterPreDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      filter = filterCreator(createFilterCreatorParams({ config })) as FilterType
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
      filter = filterCreator(createFilterCreatorParams({ config })) as FilterType
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
