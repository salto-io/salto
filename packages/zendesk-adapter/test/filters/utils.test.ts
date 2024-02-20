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
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  getChangeData,
  AdditionChange,
} from '@salto-io/adapter-api'
import { ZENDESK, BRAND_TYPE_NAME, CUSTOM_FIELD_OPTIONS_FIELD_NAME, ARTICLE_TYPE_NAME } from '../../src/constants'
import {
  createAdditionalParentChanges,
  getBrandsForGuide,
  getCustomFieldOptionsFromChanges,
  transformReferenceUrls,
} from '../../src/filters/utils'

describe('Zendesk utils', () => {
  describe('getBrandsForGuide', () => {
    const brandType = new ObjectType({
      elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    })
    const brandInstances = [
      new InstanceElement('guideTest', brandType, {
        name: 'guideTest',
        has_help_center: true,
      }),
      new InstanceElement('TestforGuide', brandType, {
        name: 'TestforGuide',
        has_help_center: true,
      }),
      new InstanceElement('BrandBrand', brandType, {
        name: 'BrandBrand',
        has_help_center: true,
      }),
      new InstanceElement('TestforGuide', brandType, {
        name: 'NoHelpCenterBrand',
        has_help_center: false,
      }),
    ]

    it('should return all brands with help center', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['.*'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res.map(r => r.elemID.name).sort()).toEqual(['BrandBrand', 'TestforGuide', 'guideTest'])
    })
    it('it should exclude all brands that contain the word Test', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['^((?!Test).)*$'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res.map(r => r.elemID.name)).toEqual(['BrandBrand'])
    })
    it('should return an empty list of brands', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['NoBrand', 'SomeBrand'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res).toEqual([])
    })
  })

  describe('createAdditionalParentChanges', () => {
    let parentInstance: InstanceElement
    let childInstance: InstanceElement
    beforeAll(() => {
      parentInstance = new InstanceElement(
        'parentInstance',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'parent') }),
        {},
      )
      childInstance = new InstanceElement(
        'childInstance',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'child') }),
        {},
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentInstance.elemID, parentInstance)] },
      )
      parentInstance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
        new ReferenceExpression(childInstance.elemID, childInstance),
      ]
    })
    it('should clone the parent and not change the original parent on change of the generated parent', async () => {
      const newParentChanges = await createAdditionalParentChanges([toChange({ after: childInstance })])

      expect(newParentChanges).toHaveLength(1)
      const newParent = getChangeData((newParentChanges as AdditionChange<InstanceElement>[])[0])

      parentInstance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME][0] = childInstance.value
      expect(newParent).toMatchObject(parentInstance)

      newParent.value = { value: 'new value' }
      expect(parentInstance.value).not.toBe({ value: 'new value' })
    })
  })
  describe('getCustomFieldOptionsFromChanges', () => {
    let parentInstance: InstanceElement

    const createCustomFieldOptions = (id: number): InstanceElement =>
      new InstanceElement(
        `customFieldOptions${id}`,
        new ObjectType({ elemID: new ElemID(ZENDESK, 'customFieldOptions') }),
        {
          raw_name: 'name',
        },
      )
    beforeAll(() => {
      parentInstance = new InstanceElement(
        'parentInstance',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'parent') }),
        {},
      )
    })
    it('should return all custom field options from changes', () => {
      const customFieldOptions1 = createCustomFieldOptions(1)
      const customFieldOptions2 = createCustomFieldOptions(2)
      parentInstance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [customFieldOptions1.value, customFieldOptions2.value]
      const changes = [
        toChange({ after: parentInstance }),
        toChange({ before: customFieldOptions2, after: customFieldOptions2 }),
      ]
      const res = getCustomFieldOptionsFromChanges('parent', 'customFieldOptions', changes)
      expect(res).toMatchObject([customFieldOptions1.value, customFieldOptions2.value, customFieldOptions2.value])
    })
    it('should ignore invalid custom field options', () => {
      const customFieldOptions1 = createCustomFieldOptions(1)
      const customFieldOptions2 = createCustomFieldOptions(2)
      customFieldOptions1.value.raw_name = 123
      customFieldOptions2.value.raw_name = ['name']
      parentInstance.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [customFieldOptions1.value, customFieldOptions2.value]
      const changes = [
        toChange({ after: parentInstance }),
        toChange({ before: customFieldOptions2, after: customFieldOptions2 }),
      ]
      const res = getCustomFieldOptionsFromChanges('parent', 'customFieldOptions', changes)
      expect(res).toMatchObject([])
    })
  })
  describe('transformReferenceUrls', () => {
    let brand: InstanceElement
    let article: InstanceElement
    let instancesById: Record<string, InstanceElement>
    beforeEach(() => {
      brand = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
        id: 1,
        name: 'brand',
      })
      article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
        id: 2,
      })
      instancesById = {
        [brand.value.id]: brand,
        [article.value.id]: article,
      }
    })
    it('should replace ids with references of the same id', () => {
      const result = transformReferenceUrls({
        urlPart: '/articles/2',
        instancesById,
      })
      expect(result).toMatchObject(['/articles/', new ReferenceExpression(article.elemID, article)])
    })
    it('should create missing references for ids that are not in the elements', () => {
      const result = transformReferenceUrls({
        urlPart: '/articles/3',
        instancesById,
        enableMissingReferences: true,
      })
      const missingArticle = new InstanceElement(
        'missing_3',
        new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
        { id: '3' },
      )
      expect(result).toMatchObject(['/articles/', new ReferenceExpression(missingArticle.elemID, missingArticle)])
    })
    it('should add the given brand url to the missing references', () => {
      const result = transformReferenceUrls({
        urlPart: '/articles/3',
        instancesById,
        enableMissingReferences: true,
        brandOfInstance: brand,
      })
      const missingArticle = new InstanceElement(
        'missing_brand_3',
        new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
        { id: '3' },
      )
      expect(result).toMatchObject(['/articles/', new ReferenceExpression(missingArticle.elemID, missingArticle)])
    })
    it('should do nothing if nothing matches', () => {
      const result = transformReferenceUrls({
        urlPart: 'nothing',
        instancesById,
      })
      expect(result).toMatchObject(['nothing'])
    })
  })
})
