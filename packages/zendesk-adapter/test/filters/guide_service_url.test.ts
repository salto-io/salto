/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import filterCreator from '../../src/filters/guide_service_url'
import { createFilterCreatorParams } from '../utils'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
  ZENDESK,
  BRAND_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
} from '../../src/constants'

describe('guide service_url filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const guideSettingsType = new ObjectType({
    elemID: new ElemID(ZENDESK, GUIDE_SETTINGS_TYPE_NAME),
  })
  const sectionType = new ObjectType({
    elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME),
  })
  const categoryType = new ObjectType({
    elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME),
  })
  const articleType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
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
  const guideLanguageSettingsType = new ObjectType({
    elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME),
  })

  const guideLanguageSettingsInstance = new InstanceElement('instance', guideLanguageSettingsType, {
    brand: 123,
  })

  const brandInstance = new InstanceElement('instance', brandType, {
    id: 123,
    brand_url: 'https://free-tifder.zendesk.com',
  })

  const guideSettingsInstance = new InstanceElement('instance', guideSettingsType, {
    brand: 123,
  })
  const sectionInstance = new InstanceElement('instance', sectionType, {
    id: 1,
    brand: 123,
  })
  const sectionInstanceWithoutBrand = new InstanceElement('instance', sectionType, {
    id: 1,
    brand: null,
  })
  const categoryInstance = new InstanceElement('instance', categoryType, {
    id: 2,
    brand: 123,
  })
  const categoryInstanceWithoutId = new InstanceElement('instance', categoryType, {
    id: null,
    brand: 123,
  })
  const articleInstance = new InstanceElement('instance', articleType, {
    id: 3,
    brand: 123,
    source_locale: 'en-us',
  })
  const articleInstanceWithObjectLocale = new InstanceElement('instance', articleType, {
    id: 3,
    brand: 123,
    source_locale: { value: 'en-us' },
  })
  const articleTranslationInstance = new InstanceElement('instance', articleTranslationType, {
    brand: 123,
    locale: 'he',
  })
  articleTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(articleType.elemID.createNestedID('instance', 'Test1'), articleInstance),
  ]

  const sectionTranslationInstance = new InstanceElement('instance', sectionTranslationType, {
    brand: 123,
    locale: 'he',
  })
  sectionTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(sectionType.elemID.createNestedID('instance', 'Test1'), sectionInstance),
  ]
  const categoryTranslationInstance = new InstanceElement('instance', categoryTranslationType, {
    brand: 123,
    locale: 'he',
  })
  categoryTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(categoryType.elemID.createNestedID('instance', 'Test1'), categoryInstance),
  ]

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'brandWithHC' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('onFetch', () => {
    it('should create correct service urls', async () => {
      const elements = [
        guideSettingsInstance,
        sectionInstance,
        categoryInstance,
        articleInstance,
        articleTranslationInstance,
        sectionTranslationInstance,
        categoryTranslationInstance,
        guideLanguageSettingsInstance,
      ]
      await filter.onFetch([elements, brandInstance].flat())
      expect(elements.map(elem => elem.annotations[CORE_ANNOTATIONS.SERVICE_URL]).sort()).toEqual([
        'https://brandwithhc.zendesk.com/knowledge/arrange/categories/2?brand_id=123',
        'https://brandwithhc.zendesk.com/knowledge/arrange/sections/1?brand_id=123',
        'https://brandwithhc.zendesk.com/knowledge/articles/3/en-us?brand_id=123',
        'https://brandwithhc.zendesk.com/knowledge/articles/3/he?brand_id=123',
        'https://brandwithhc.zendesk.com/knowledge/sections/1?brand_id=123&locale=he',
        'https://free-tifder.zendesk.com/hc/admin/categories/2/edit?translation_locale=he',
        'https://free-tifder.zendesk.com/hc/admin/general_settings',
        'https://free-tifder.zendesk.com/hc/admin/language_settings',
      ])
    })
    it('should not create service urls when there are invalid params', async () => {
      const elements = [sectionInstanceWithoutBrand, categoryInstanceWithoutId, articleInstanceWithObjectLocale]
      await filter.onFetch(elements)
      elements.forEach(elem => {
        expect(elem.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
      })
    })
  })
})
