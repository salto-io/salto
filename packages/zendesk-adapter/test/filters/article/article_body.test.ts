/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ElemID,
  InstanceElement,
  ObjectType,
  BuiltinTypes,
  toChange,
  isInstanceElement,
  TemplateExpression,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  UnresolvedReference,
} from '@salto-io/adapter-api'
import { filterUtils, references as referencesUtils } from '@salto-io/adapter-components'
import filterCreator from '../../../src/filters/article/article_body'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  BRAND_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME,
  ZENDESK,
} from '../../../src/constants'
import { createFilterCreatorParams } from '../../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../../src/config'
import { FilterResult } from '../../../src/filter'
import { prepRef } from '../../../src/filters/article/utils'

const { createMissingInstance } = referencesUtils

let id = 0
const newId = (): number => {
  id += 1
  return id
}

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

  const createObjectType = (typeName: string): ObjectType =>
    new ObjectType({
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

  let brandInstance: InstanceElement
  let brandToExclude: InstanceElement
  let brandToExclude2: InstanceElement
  let emptyBrandInstance: InstanceElement
  let translationWithReferences: InstanceElement
  let translationWithMissingReferences: InstanceElement
  let translationWithoutReferences: InstanceElement
  let translationWithAttachments: InstanceElement
  let articeOfExcludedBrand: InstanceElement
  let translationWithExcludedBrand: InstanceElement
  let translationWithMixedBrands: InstanceElement
  let translationWithTemplateExpression: InstanceElement
  let articleInstance: InstanceElement
  let sectionInstance: InstanceElement
  let categoryInstance: InstanceElement
  let attachmentInstance: InstanceElement
  let parentArticle: InstanceElement
  let elements: (InstanceElement | ObjectType)[]

  beforeEach(() => {
    filter = filterCreator(createFilterCreatorParams({ config })) as FilterType

    brandInstance = new InstanceElement('brand', brandType, {
      id: newId(),
      brand_url: 'https://brand.zendesk.com',
      name: 'brand',
      has_help_center: true,
      subdomain: 'brandSub',
    })

    brandToExclude = new InstanceElement('excluded', brandType, {
      id: newId(),
      brand_url: 'https://excluded.zendesk.com',
      name: 'excluded',
      has_help_center: true,
      subdomain: 'excludedSub',
    })

    brandToExclude2 = new InstanceElement('excluded2', brandType, {
      id: newId(),
      brand_url: 'https://excluded2.zendesk.com',
      name: 'excluded2',
      has_help_center: true,
      subdomain: 'excluded2Sub',
    })

    emptyBrandInstance = new InstanceElement('brand2', brandType, {
      id: newId(),
      brand_url: 'https://brand2.zendesk.com',
      name: 'brand2',
      has_help_center: true,
      subdomain: 'brand2Sub',
    })

    const createInstanceElement = (type: ObjectType): InstanceElement =>
      new InstanceElement(type.elemID.name, type, {
        id: newId(),
        brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
      })

    articleInstance = createInstanceElement(articleType)
    sectionInstance = createInstanceElement(sectionType)
    categoryInstance = createInstanceElement(categoryType)
    attachmentInstance = createInstanceElement(attachmentType)
    // To test that the code catches both brand as id and brand as reference expression
    attachmentInstance.value.brand = brandInstance.value.id

    parentArticle = new InstanceElement('articleParent', articleType, { id: 100, name: 'ar' })
    translationWithReferences = new InstanceElement(
      'translationWithReferences',
      articleTranslationType,
      {
        id: newId(),
        body: `<p><a href="https://brand.zendesk.com/hc/en-us/articles/${articleInstance.value.id}/sep/sections/${sectionInstance.value.id}/sep/categories/${categoryInstance.value.id}/sep/article_attachments/${attachmentInstance.value.id}-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://brand.zendesk.com/hc/he/articles/${articleInstance.value.id}-extra_string"`,
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )

    translationWithMissingReferences = new InstanceElement(
      'translationWithMissingReferences',
      articleTranslationType,
      {
        id: newId(),
        body: `<p><a href="https://brand2.zendesk.com/hc/en-us/articles/0/sep/sections/0/sep/categories/0/sep/article_attachments/0-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://brand.zendesk.com/hc/he/articles/${articleInstance.value.id}-extra_string"`,
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )

    translationWithoutReferences = new InstanceElement(
      'translationWithoutReferences',
      articleTranslationType,
      {
        id: newId(),
        body: '<p><a href="https://nobrand.zendesk.com/hc/en-us/articles/0/sep/sections/0/sep/categories/0/sep/article_attachments/0-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://nobrand.zendesk.com/hc/he/articles/0-extra_string"',
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )

    translationWithAttachments = new InstanceElement(
      'articleWithAttachments',
      articleTranslationType,
      {
        id: newId(),
        body: `<p><img src="https://brand.zendesk.com/hc/article_attachments/${attachmentInstance.value.id}" alt="alttext"><img src="https://brand.zendesk.com/hc/article_attachments/${attachmentInstance.value.id}" alt="alttext"></p>`,
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )

    articeOfExcludedBrand = new InstanceElement('12321312', articleType, {
      id: newId(),
      brand: new ReferenceExpression(brandToExclude.elemID, brandToExclude),
    })
    translationWithExcludedBrand = new InstanceElement(
      'articleWithExcludedBrand',
      articleTranslationType,
      {
        id: newId(),
        body: '<p><a href="https://excluded.zendesk.com/hc/en-us/articles/0" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh',
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )

    translationWithMixedBrands = new InstanceElement(
      'articleWithMixedBrand',
      articleTranslationType,
      {
        id: newId(),
        body: `<p><a href="https://brand.zendesk.com/hc/en-us/articles/${articleInstance.value.id}" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh`,
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )

    translationWithTemplateExpression = new InstanceElement(
      'articleWithTemplateExpression',
      articleTranslationType,
      {
        id: newId(),
        body: `${attachmentInstance.value.id}<p><a href="https://brand.zendesk.com/hc/en-us/articles/${articleInstance.value.id}" target="_self">linkedArticle</a>${attachmentInstance.value.id}`,
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentArticle.elemID, parentArticle)] },
    )

    elements = [
      brandInstance,
      brandToExclude,
      brandToExclude2,
      emptyBrandInstance,
      articleInstance,
      sectionInstance,
      categoryInstance,
      attachmentInstance,
      translationWithReferences,
      translationWithMissingReferences,
      translationWithoutReferences,
      translationWithAttachments,
      translationWithExcludedBrand,
      translationWithTemplateExpression,
      parentArticle,
      translationWithMixedBrands,
      articeOfExcludedBrand,
    ]
  })

  describe('on fetch', () => {
    describe('when all brands included', () => {
      beforeEach(async () => {
        config[FETCH_CONFIG].guide = { brands: ['.*'] }
        filter = filterCreator(createFilterCreatorParams({ config })) as FilterType
      })
      it('should convert all possible urls to references', async () => {
        const filterResult = (await filter.onFetch(elements)) as FilterResult
        const fetchedTranslationWithReferences = elements
          .filter(isInstanceElement)
          .find(i => i.elemID.name === 'translationWithReferences')
        expect(fetchedTranslationWithReferences?.value.body).toEqual(
          new TemplateExpression({
            parts: [
              '<p><a href="',
              new ReferenceExpression(brandInstance.elemID, brandInstance),
              '/hc/en-us/articles/',
              new ReferenceExpression(articleInstance.elemID, articleInstance),
              '/sep/sections/',
              new ReferenceExpression(sectionInstance.elemID, sectionInstance),
              '/sep/categories/',
              new ReferenceExpression(categoryInstance.elemID, categoryInstance),
              '/sep/article_attachments/',
              new ReferenceExpression(attachmentInstance.elemID, attachmentInstance),
              '-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="',
              new ReferenceExpression(brandInstance.elemID, brandInstance),
              '/hc/he/articles/',
              new ReferenceExpression(articleInstance.elemID, articleInstance),
              '-extra_string"',
            ],
          }),
        )
        expect(filterResult.errors).toHaveLength(0)
      })
      it('should only match elements that exists', async () => {
        const filterResult = (await filter.onFetch(elements)) as FilterResult
        const brandName = emptyBrandInstance.value.name
        const missingArticleInstance = createMissingInstance(ZENDESK, ARTICLE_TYPE_NAME, `${brandName}_0`)
        const missingSectionInstance = createMissingInstance(ZENDESK, SECTION_TYPE_NAME, `${brandName}_0`)
        const missingCategoryInstance = createMissingInstance(ZENDESK, CATEGORY_TYPE_NAME, `${brandName}_0`)
        const missingArticleAttachmentInstance = createMissingInstance(
          ZENDESK,
          ARTICLE_ATTACHMENT_TYPE_NAME,
          `${brandName}_0`,
        )
        missingArticleInstance.value.id = '0'
        missingSectionInstance.value.id = '0'
        missingCategoryInstance.value.id = '0'
        missingArticleAttachmentInstance.value.id = '0'
        const fetchedTranslationWithoutReferences = elements
          .filter(isInstanceElement)
          .find(i => i.elemID.name === 'translationWithMissingReferences')
        expect(fetchedTranslationWithoutReferences?.value.body).toEqual(
          new TemplateExpression({
            parts: [
              '<p><a href="',
              new ReferenceExpression(emptyBrandInstance.elemID, emptyBrandInstance),
              '/hc/en-us/articles/',
              new ReferenceExpression(missingArticleInstance.elemID, missingArticleInstance),
              '/sep/sections/',
              new ReferenceExpression(missingSectionInstance.elemID, missingSectionInstance),
              '/sep/categories/',
              new ReferenceExpression(missingCategoryInstance.elemID, missingCategoryInstance),
              '/sep/article_attachments/',
              new ReferenceExpression(missingArticleAttachmentInstance.elemID, missingArticleAttachmentInstance),
              '-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="',
              new ReferenceExpression(brandInstance.elemID, brandInstance),
              '/hc/he/articles/',
              new ReferenceExpression(articleInstance.elemID, articleInstance),
              '-extra_string"',
            ],
          }),
        )
        expect(filterResult.errors).toHaveLength(0)
      })
      it('should handle translation with template expression in body', async () => {
        translationWithTemplateExpression.value.body = new TemplateExpression({
          parts: [
            new ReferenceExpression(attachmentInstance.elemID, attachmentInstance),
            `<p><a href="https://brand.zendesk.com/hc/en-us/articles/${articleInstance.value.id}" target="_self">linkedArticle</a>`,
            new ReferenceExpression(attachmentInstance.elemID, attachmentInstance),
          ],
        })
        const filterResult = (await filter.onFetch(elements)) as FilterResult
        const fetchedTranslationWithTemplateExpression = elements
          .filter(isInstanceElement)
          .find(i => i.elemID.name === 'articleWithTemplateExpression')
        expect(fetchedTranslationWithTemplateExpression?.value.body).toEqual(
          new TemplateExpression({
            parts: [
              new ReferenceExpression(attachmentInstance.elemID, attachmentInstance),
              '<p><a href="',
              new ReferenceExpression(brandInstance.elemID, brandInstance),
              '/hc/en-us/articles/',
              new ReferenceExpression(articleInstance.elemID, articleInstance),
              '" target="_self">linkedArticle</a>',
              new ReferenceExpression(attachmentInstance.elemID, attachmentInstance),
            ],
          }),
        )
        expect(filterResult.errors).toHaveLength(0)
      })
      it('should do nothing if elements do not exists', async () => {
        const filterResult = (await filter.onFetch(elements)) as FilterResult
        const fetchedTranslationWithoutReferences = elements
          .filter(isInstanceElement)
          .find(i => i.elemID.name === 'translationWithoutReferences')
        expect(fetchedTranslationWithoutReferences?.value.body).toEqual(
          '<p><a href="https://nobrand.zendesk.com/hc/en-us/articles/0/sep/sections/0/sep/categories/0/sep/article_attachments/0-extra_string" target="_self">linkedArticle</a></p>kjdsahjkdshjkdsjkh\n<a href="https://nobrand.zendesk.com/hc/he/articles/0-extra_string"',
        )
        expect(filterResult.errors).toHaveLength(0)
      })
    })

    describe('when some brands are excluded', () => {
      beforeEach(() => {
        config[FETCH_CONFIG].guide = { brands: ['^(?!excluded).*$'] }
        filter = filterCreator(createFilterCreatorParams({ config })) as FilterType
      })
      it('should not create reference for urls of excluded brands', async () => {
        const filterResult = (await filter.onFetch(elements)) as FilterResult
        const fetchedTranslationWithReferences = elements
          .filter(isInstanceElement)
          .find(i => i.elemID.name === 'articleWithExcludedBrand')
        expect(fetchedTranslationWithReferences?.value.body).toEqual(
          '<p><a href="https://excluded.zendesk.com/hc/en-us/articles/0" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh',
        )
        const fetchedTranslationWithReferences2 = elements
          .filter(isInstanceElement)
          .find(i => i.elemID.name === 'articleWithMixedBrand')
        expect(fetchedTranslationWithReferences2?.value.body).toEqual(
          new TemplateExpression({
            parts: [
              '<p><a href="',
              new ReferenceExpression(brandInstance.elemID, brandInstance),
              '/hc/en-us/articles/',
              new ReferenceExpression(articleInstance.elemID, articleInstance),
              '" target="_self">linkedArticle</a><img src="https://excluded2.zendesk.com/hc/article_attachments/bla" alt="alttext"></p>kjdsahjkdshjkdsjkh',
            ],
          }),
        )
        expect(filterResult.errors).toHaveLength(2)
        expect(filterResult.errors?.[0]).toEqual({
          message:
            'Brand excluded (subdomain excludedSub) is referenced by articles, but it is not currently fetched - therefore URLs pointing to it are treated as external, and will not be modified if these articles are deployed to another environment.\nIf you would like to include this brand, please add it under fetch.guide.brands.\nThe brand is referenced from the following articles (partial list limited to 10): articleParent',
          severity: 'Warning',
        })
        expect(filterResult.errors?.[1]).toEqual({
          message:
            'Brand excluded2 (subdomain excluded2Sub) is referenced by articles, but it is not currently fetched - therefore URLs pointing to it are treated as external, and will not be modified if these articles are deployed to another environment.\nIf you would like to include this brand, please add it under fetch.guide.brands.\nThe brand is referenced from the following articles (partial list limited to 10): articleParent',
          severity: 'Warning',
        })
      })
    })
  })
  describe('preDeploy', () => {
    it('Returns elements to origin after predeploy', async () => {
      const elementsAfterFetch = elements.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      expect(elementsAfterPreDeploy).toEqual(elements)
    })
  })

  describe('onDeploy', () => {
    it('Returns elements to after fetch state (with templates) after onDeploy', async () => {
      // we recreate feth and onDeploy to have the templates in place to be restored by onDeploy
      const elementsAfterFetch = elements.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      const elementsAfterOnDeploy = elementsAfterPreDeploy.map(e => e.clone())
      await filter.onDeploy(elementsAfterOnDeploy.map(e => toChange({ before: e, after: e })))
      expect(elementsAfterOnDeploy).toEqual(elementsAfterFetch)
    })
  })
  describe('prepRef', () => {
    it('should return an empty string on UnresolvedReference', () => {
      const elemId = new ElemID(ZENDESK, 'test')
      const unresolvedRef = new UnresolvedReference(elemId)
      const unresolvedPrepRef = prepRef(new ReferenceExpression(elemId, unresolvedRef))

      expect(unresolvedPrepRef).toEqual('')
    })
  })
})
