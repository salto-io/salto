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
import { filterUtils } from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  StaticFile,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  BRAND_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
  ZENDESK,
  CATEGORY_ORDER_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  PERMISSION_GROUP_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
  GUIDE,
  ARTICLE_ATTACHMENTS_FIELD,
} from '../../src/constants'
import filterCreator, { GUIDE_ELEMENT_DIRECTORY, GUIDE_PATH, UNSORTED } from '../../src/filters/guide_arrange_paths'
import { createFilterCreatorParams } from '../utils'

describe('guide arrange paths', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const userSegmentType = new ObjectType({
    elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME),
  })
  const guideSettingsType = new ObjectType({
    elemID: new ElemID(ZENDESK, GUIDE_SETTINGS_TYPE_NAME),
  })
  const permissionGroupType = new ObjectType({
    elemID: new ElemID(ZENDESK, PERMISSION_GROUP_TYPE_NAME),
  })
  const sectionType = new ObjectType({
    elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME),
  })
  const articleType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
  })
  const categoryType = new ObjectType({
    elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME),
  })
  const articleTranslationType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME),
  })
  const sectionTranslationType = new ObjectType({
    elemID: new ElemID(ZENDESK, SECTION_TRANSLATION_TYPE_NAME),
  })
  const categoryTranslationType = new ObjectType({
    elemID: new ElemID(ZENDESK, CATEGORY_TRANSLATION_TYPE_NAME),
  })
  const guideTranslationType = new ObjectType({
    elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME),
  })
  const sectionOrderType = new ObjectType({
    elemID: new ElemID(ZENDESK, SECTION_ORDER_TYPE_NAME),
  })
  const categoryOrderType = new ObjectType({
    elemID: new ElemID(ZENDESK, CATEGORY_ORDER_TYPE_NAME),
  })
  const articleAttachmentType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME),
  })

  const BRAND_PATH = ['brands', 'best brand']

  const brandInstance = new InstanceElement('instance1', brandType, {
    id: 123,
    name: BRAND_PATH[1],
  })
  const userSegmentInstance = new InstanceElement('instance2', userSegmentType, {})
  const permissionGroupInstance = new InstanceElement('instance3', permissionGroupType, {})

  const guideSettingsInstance = new InstanceElement('instance4', guideSettingsType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
  })
  const categoryInstance = new InstanceElement('instance5', categoryType, {
    id: 1,
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    name: 'category.name',
  })
  const sectionInstance = new InstanceElement('instance6', sectionType, {
    id: 2,
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
    direct_parent_type: 'category',
    name: 'section name',
  })
  const sectionInSectionInstance = new InstanceElement('instance7', sectionType, {
    id: 3,
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    direct_parent_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
    direct_parent_type: 'section',
    name: 'section in section name',
  })
  const sectionInInSectionInstance = new InstanceElement('instance15', sectionType, {
    id: 5,
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    direct_parent_id: new ReferenceExpression(sectionInSectionInstance.elemID, sectionInSectionInstance),
    direct_parent_type: 'section',
    name: 'section in section in section name',
  })
  const articleInstance = new InstanceElement('instance8', articleType, {
    id: 4,
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
    source_locale: 'en-us',
    title: 'article name',
  })
  const articleTranslationInstance = new InstanceElement('instance9', articleTranslationType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    title: 'article name',
    locale: 'en-us',
  })
  articleTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(articleInstance.elemID, articleInstance),
  ]
  articleInstance.value.translations = [
    new ReferenceExpression(articleTranslationInstance.elemID, articleTranslationInstance),
  ]
  const content = Buffer.from('test')
  const articleAttachmentInstance = new InstanceElement('attachment', articleAttachmentType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    content: new StaticFile({ filepath: 'something', content }),
    file_name: 'attachment',
  })
  articleAttachmentInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(articleInstance.elemID, articleInstance),
  ]
  articleInstance.value.attachments = [
    new ReferenceExpression(articleAttachmentInstance.elemID, articleAttachmentInstance),
  ]

  const sectionTranslationInstance = new InstanceElement('instance10', sectionTranslationType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    locale: 'en-us',
  })
  sectionTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(sectionInstance.elemID, sectionInstance),
  ]
  const categoryTranslationInstance = new InstanceElement('instance11', categoryTranslationType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    locale: 'en-us',
  })
  categoryTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(categoryInstance.elemID, categoryInstance),
  ]

  const languageSettingsInstance = new InstanceElement('instance12', guideTranslationType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    locale: 'en-us',
  })
  const sectionOrderInstance = new InstanceElement('instance13', sectionOrderType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
  })
  sectionOrderInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(sectionInstance.elemID, sectionInstance),
  ]

  const categoryOrderInstance = new InstanceElement('instance14', categoryOrderType, {
    brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
  })
  categoryOrderInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(categoryInstance.elemID, categoryInstance),
  ]

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'brandWithHC' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('onFetch', () => {
    it('should create correct paths', async () => {
      const elements = [
        guideSettingsInstance,
        userSegmentInstance,
        permissionGroupInstance,
        sectionInstance,
        sectionInSectionInstance,
        sectionInInSectionInstance,
        categoryInstance,
        articleInstance,
        articleTranslationInstance,
        sectionTranslationInstance,
        categoryTranslationInstance,
        languageSettingsInstance,
        sectionOrderInstance,
        categoryOrderInstance,
        articleAttachmentInstance,
      ].map(e => e.clone())
      await filter.onFetch([elements, brandInstance].flat())
      expect(elements.map(elem => elem.path)).toEqual([
        [...GUIDE_PATH, ...BRAND_PATH, GUIDE_ELEMENT_DIRECTORY[GUIDE_SETTINGS_TYPE_NAME], 'brand_settings'],
        [...GUIDE_PATH, GUIDE_ELEMENT_DIRECTORY[USER_SEGMENT_TYPE_NAME], 'instance2'],
        [...GUIDE_PATH, GUIDE_ELEMENT_DIRECTORY[PERMISSION_GROUP_TYPE_NAME], 'instance3'],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          'section_name',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          'section_in_section_name',
          'section_in_section_name',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          'section_in_section_name',
          'section_in_section_in_section_name',
          'section_in_section_in_section_name',
        ],
        [...GUIDE_PATH, ...BRAND_PATH, GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME], 'category_name', 'category_name'],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'article_name',
          'article_name',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'article_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TRANSLATION_TYPE_NAME],
          'en_us',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME],
          'en_us',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME],
          'en_us',
        ],
        [...GUIDE_PATH, ...BRAND_PATH, GUIDE_ELEMENT_DIRECTORY[GUIDE_LANGUAGE_SETTINGS_TYPE_NAME], 'en_us'],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_ORDER_TYPE_NAME],
          'section_order',
        ],
        [...GUIDE_PATH, ...BRAND_PATH, GUIDE_ELEMENT_DIRECTORY[CATEGORY_ORDER_TYPE_NAME], 'category_order'],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'article_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_ATTACHMENT_TYPE_NAME],
          'attachment',
        ],
      ])
    })
    it('should not raise error when global types dont exist', async () => {
      const elements = [
        guideSettingsInstance,
        sectionInstance,
        sectionInSectionInstance,
        categoryInstance,
        articleInstance,
        articleTranslationInstance,
        sectionTranslationInstance,
        categoryTranslationInstance,
        languageSettingsInstance,
      ].map(e => e.clone())
      await filter.onFetch([elements, brandInstance].flat())
      expect(elements.map(elem => elem.path)).toEqual([
        [...GUIDE_PATH, ...BRAND_PATH, GUIDE_ELEMENT_DIRECTORY[GUIDE_SETTINGS_TYPE_NAME], 'brand_settings'],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          'section_name',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          'section_in_section_name',
          'section_in_section_name',
        ],
        [...GUIDE_PATH, ...BRAND_PATH, GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME], 'category_name', 'category_name'],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'article_name',
          'article_name',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'article_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TRANSLATION_TYPE_NAME],
          'en_us',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME],
          'en_us',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME],
          'en_us',
        ],
        [...GUIDE_PATH, ...BRAND_PATH, GUIDE_ELEMENT_DIRECTORY[GUIDE_LANGUAGE_SETTINGS_TYPE_NAME], 'en_us'],
      ])
    })
    it('should handle article attachment static file correctly', async () => {
      const elements = [sectionInstance, categoryInstance, articleInstance, articleAttachmentInstance].map(e =>
        e.clone(),
      )
      await filter.onFetch([elements, brandInstance].flat())
      const staticFile = elements[3].value.content
      expect(staticFile.filepath).toEqual(
        [
          ZENDESK,
          ARTICLE_ATTACHMENTS_FIELD,
          GUIDE,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'category_name',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'section_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'article_name',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_ATTACHMENT_TYPE_NAME],
          'attachment',
          `${staticFile.hash.slice(0, 10)}_attachment`,
        ].join('/'),
      )
      expect(staticFile.isEqual(articleAttachmentInstance.value.content)).toBeTruthy()
    })
    it('should not raise error when parent types dont exist', async () => {
      const elements = [articleTranslationInstance, sectionTranslationInstance, categoryTranslationInstance].map(e =>
        e.clone(),
      )
      await filter.onFetch([elements, brandInstance].flat())
      expect(elements.map(elem => elem.path)).toEqual([
        [...GUIDE_PATH, UNSORTED, GUIDE_ELEMENT_DIRECTORY[ARTICLE_TRANSLATION_TYPE_NAME], 'instance9'],
        [...GUIDE_PATH, UNSORTED, GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME], 'instance10'],
        [...GUIDE_PATH, UNSORTED, GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME], 'instance11'],
      ])
    })
    it('should not raise error when id field of parent is missing', async () => {
      const articleMissingIdInstance = new InstanceElement('instance1', articleType, {
        brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
        section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
      })
      const articleTranslationMissingIdInstance = new InstanceElement('instance2', articleTranslationType, {
        brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
      })
      articleTranslationMissingIdInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(articleMissingIdInstance.elemID, articleMissingIdInstance),
      ]
      const elements = [articleMissingIdInstance, articleTranslationMissingIdInstance].map(e => e.clone())
      await filter.onFetch([elements, brandInstance].flat())
      expect(elements.map(elem => elem.path)).toEqual([
        [...GUIDE_PATH, UNSORTED, GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME], 'instance1'],
        [...GUIDE_PATH, UNSORTED, GUIDE_ELEMENT_DIRECTORY[ARTICLE_TRANSLATION_TYPE_NAME], 'instance2'],
      ])
    })
    it('should not raise error when direct_parent_id is missing', async () => {
      const sectionNoDirectParentInstance = new InstanceElement('instance2', sectionType, {
        id: 2,
        brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
      })
      const elements = [sectionNoDirectParentInstance].map(e => e.clone())
      await filter.onFetch([elements, brandInstance].flat())
      expect(elements.map(elem => elem.path)).toEqual([
        [...GUIDE_PATH, UNSORTED, GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME], 'instance2'],
      ])
    })
    it('should not raise error when brandName is missing', async () => {
      const brandNoNameInstance = new InstanceElement('instance1', brandType, {
        id: 123,
        name: BRAND_PATH[1],
      })
      const sectionNoBrandNameInstance = new InstanceElement('instance2', sectionType, {
        id: 2,
        brand: new ReferenceExpression(brandNoNameInstance.elemID, brandNoNameInstance),
        direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
        direct_parent_type: 'category',
      })
      const elements = [sectionNoBrandNameInstance].map(e => e.clone())
      await filter.onFetch([elements, brandNoNameInstance].flat())
      expect(elements.map(elem => elem.path)).toEqual([
        [...GUIDE_PATH, UNSORTED, GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME], 'instance2'],
      ])
    })
  })
})
