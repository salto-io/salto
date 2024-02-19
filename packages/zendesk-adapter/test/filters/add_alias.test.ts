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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/add_alias'
import {
  CATEGORY_ORDER_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'

describe('add alias filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let client: ZendeskClient

  const appInstallationTypeName = 'app_installation'
  const dynamicContentItemTypeName = 'dynamic_content_item'
  const dynamicContentItemVariantsTypeName = 'dynamic_content_item__variants'
  const localeTypeName = 'locale'
  const categoryTypeName = CATEGORY_TYPE_NAME
  const categoryOrderTypeName = CATEGORY_ORDER_TYPE_NAME
  const categoryTranslationTypeName = CATEGORY_TRANSLATION_TYPE_NAME

  const appInstallationType = new ObjectType({ elemID: new ElemID(ZENDESK, appInstallationTypeName) })
  const dynamicContentItemType = new ObjectType({ elemID: new ElemID(ZENDESK, dynamicContentItemTypeName) })
  const dynamicContentItemVariantsType = new ObjectType({
    elemID: new ElemID(ZENDESK, dynamicContentItemVariantsTypeName),
  })
  const localeType = new ObjectType({ elemID: new ElemID(ZENDESK, localeTypeName) })
  const categoryType = new ObjectType({ elemID: new ElemID(ZENDESK, categoryTypeName) })
  const categoryOrderType = new ObjectType({ elemID: new ElemID(ZENDESK, categoryOrderTypeName) })
  const categoryTranslationType = new ObjectType({ elemID: new ElemID(ZENDESK, categoryTranslationTypeName) })

  const localeInstance = new InstanceElement('instance4', localeType, {
    locale: 'en-us', // will be used for category translation
    presentation_name: 'en-us',
  })

  const categoryInstance = new InstanceElement('instance6', categoryType, {
    name: 'category name',
  })

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(
      createFilterCreatorParams({
        client,
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [
              {
                type: '.*',
              },
            ],
            exclude: [],
            guide: {
              brands: ['.*'],
            },
            addAlias: true,
          },
        },
      }),
    ) as FilterType
  })

  describe('onFetch', () => {
    it('should add alias annotation correctly', async () => {
      const appInstallationInstance = new InstanceElement('instance1', appInstallationType, {
        settings: { name: 'app installation name' },
      })
      const appInstallationInstanceInvalid = new InstanceElement('instance2', appInstallationType, {})
      const dynamicContentItemInstance = new InstanceElement('instance3', dynamicContentItemType, {
        name: 'dynamic content name',
      })
      const dynamicContentItemVariantsInstance = new InstanceElement(
        'instance5',
        dynamicContentItemVariantsType,
        {
          locale_id: new ReferenceExpression(localeInstance.elemID, localeInstance),
        },
        undefined,
        {
          _parent: [new ReferenceExpression(dynamicContentItemInstance.elemID, dynamicContentItemInstance)],
        },
      )
      const categoryOrderInstance = new InstanceElement('instance7', categoryOrderType, {}, undefined, {
        _parent: [new ReferenceExpression(categoryInstance.elemID, categoryInstance)],
      })
      const categoryTranslationInstance = new InstanceElement(
        'instance8',
        categoryTranslationType,
        {
          locale: new ReferenceExpression(localeInstance.elemID, localeInstance),
        },
        undefined,
        {
          _parent: [new ReferenceExpression(categoryInstance.elemID, categoryInstance)],
        },
      )
      const categoryTranslationInstanceInvalid = new InstanceElement('instance9', categoryTranslationType, {
        locale: new ReferenceExpression(localeInstance.elemID),
      })
      const elements = [
        appInstallationInstance,
        appInstallationInstanceInvalid,
        dynamicContentItemInstance,
        localeInstance,
        dynamicContentItemVariantsInstance,
        categoryInstance,
        categoryOrderInstance,
        categoryTranslationInstance,
        categoryTranslationInstanceInvalid,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([
        'app installation name',
        undefined,
        'dynamic content name',
        'en-us',
        'dynamic content name - en-us',
        'category name',
        'category name Category Order',
        'en-us - category name',
        undefined,
      ])
    })
    it('should not crush when one of the values is undefined', async () => {
      const appInstallationInstanceInvalid = new InstanceElement('instance2', appInstallationType, {
        settings: { name: undefined },
      })
      const elements = [appInstallationInstanceInvalid]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
    it('should not crush when there is not parent', async () => {
      const categoryTranslationInstance = new InstanceElement(
        'instance8',
        categoryTranslationType,
        {
          locale: new ReferenceExpression(localeInstance.elemID, localeInstance),
        },
        undefined,
      )
      const elements = [categoryTranslationInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
    it('should not crush when there is a value instead of a reference', async () => {
      const categoryTranslationInstance = new InstanceElement(
        'instance8',
        categoryTranslationType,
        {
          locale: 'en-US',
        },
        undefined,
        {
          _parent: [new ReferenceExpression(categoryInstance.elemID, categoryInstance)],
        },
      )
      const elements = [categoryTranslationInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
    it('should not crush when there is a reference instead of a value', async () => {
      const dynamicContentItemInstance = new InstanceElement('instance3', dynamicContentItemType, {
        name: new ReferenceExpression(localeInstance.elemID, localeInstance),
      })
      const elements = [dynamicContentItemInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
  })
})
