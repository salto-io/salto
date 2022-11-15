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
import { filterUtils } from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  BRAND_TYPE_NAME, CATEGORY_TRANSLATION_TYPE_NAME, CATEGORY_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME, SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
  ZENDESK,
  USER_SEGMENT_TYPE_NAME, PERMISSION_GROUP_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
} from '../../src/constants'
import filterCreator, {
  GUIDE_ELEMENT_DIRECTORY,
  GUIDE_PATH,
} from '../../src/filters/guide_arrange_paths'
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
  const BRAND_PATH = ['brands', 'best brand']

  const brandInstance = new InstanceElement(
    'instance1',
    brandType,
    {
      id: 123,
      name: BRAND_PATH[1],
    }
  )
  const userSegmentInstance = new InstanceElement('instance2', userSegmentType, {})
  const permissionGroupInstance = new InstanceElement('instance3', permissionGroupType, {})

  const guideSettingsInstance = new InstanceElement(
    'instance4',
    guideSettingsType,
    {
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    },
  )
  const categoryInstance = new InstanceElement(
    'instance5',
    categoryType,
    {
      id: 1,
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    },
  )
  const sectionInstance = new InstanceElement(
    'instance6',
    sectionType,
    {
      id: 2,
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
      direct_parent_id: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
      direct_parent_type: 'category',
    }
  )
  const sectionInSectionInstance = new InstanceElement(
    'instance7',
    sectionType,
    {
      id: 3,
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
      direct_parent_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
      direct_parent_type: 'section',
    }
  )
  const articleInstance = new InstanceElement(
    'instance8',
    articleType,
    {
      id: 4,
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
      section_id: new ReferenceExpression(sectionInstance.elemID, sectionInstance),
    }
  )
  const articleTranslationInstance = new InstanceElement(
    'instance9',
    articleTranslationType,
    {
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    }
  )
  articleTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
    articleInstance.elemID, articleInstance
  )]

  const sectionTranslationInstance = new InstanceElement(
    'instance10',
    sectionTranslationType,
    {
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    }
  )
  sectionTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
    sectionInstance.elemID, sectionInstance
  )]
  const categoryTranslationInstance = new InstanceElement(
    'instance11',
    categoryTranslationType,
    {
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    }
  )
  categoryTranslationInstance.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
    categoryInstance.elemID, categoryInstance
  )]

  const languageSettingsInstance = new InstanceElement(
    'instance12',
    guideTranslationType,
    {
      brand: new ReferenceExpression(brandInstance.elemID, brandInstance),
    }
  )


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
        categoryInstance,
        articleInstance,
        articleTranslationInstance,
        sectionTranslationInstance,
        categoryTranslationInstance,
        languageSettingsInstance,
      ].map(e => e.clone())
      await filter.onFetch([elements, brandInstance].flat())
      expect(elements
        .map(elem => elem.path)).toEqual([
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[GUIDE_SETTINGS_TYPE_NAME],
          'instance4',
        ],
        [
          ...GUIDE_PATH,
          GUIDE_ELEMENT_DIRECTORY[USER_SEGMENT_TYPE_NAME],
          'instance2',
        ],
        [
          ...GUIDE_PATH,
          GUIDE_ELEMENT_DIRECTORY[PERMISSION_GROUP_TYPE_NAME],
          'instance3',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'instance5',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'instance6',
          'instance6',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'instance5',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'instance6',
          'instance7',
          'instance7',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'instance5',
          'instance5',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'instance5',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'instance6',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'instance8',
          'instance8',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'instance5',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'instance6',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TYPE_NAME],
          'instance8',
          GUIDE_ELEMENT_DIRECTORY[ARTICLE_TRANSLATION_TYPE_NAME],
          'instance9',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'instance5',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TYPE_NAME],
          'instance6',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME],
          'instance10',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[CATEGORY_TYPE_NAME],
          'instance5',
          GUIDE_ELEMENT_DIRECTORY[SECTION_TRANSLATION_TYPE_NAME],
          'instance11',
        ],
        [
          ...GUIDE_PATH,
          ...BRAND_PATH,
          GUIDE_ELEMENT_DIRECTORY[GUIDE_LANGUAGE_SETTINGS_TYPE_NAME],
          'instance12',
        ],
      ])
    })
  })
})
