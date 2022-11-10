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
import { BuiltinTypes, Change, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { elements as elementsUtils, filterUtils, config as configUtils } from '@salto-io/adapter-components'
import { ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../../src/constants'
import orderInBrandsFilter from '../../src/filters/guide_order/order_in_brands'
import orderInCategoriesFilter from '../../src/filters/guide_order/order_in_categories'
import orderInSectionsFilter from '../../src/filters/guide_order/order_in_sections'
import { createFilterCreatorParams } from '../utils'
import {
  ARTICLES_FIELD,
  CATEGORIES_FIELD,
  GUIDE_ORDER_TYPES,
  SECTIONS_FIELD,
} from '../../src/filters/guide_order/guide_orders_utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'

const { RECORDS_PATH, SETTINGS_NESTED_PATH, createUrl } = elementsUtils

const client = new ZendeskClient({
  credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
})
client.put = jest.fn()

type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
const brandType = new ObjectType({
  elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  fields: {
    has_help_center: { refType: BuiltinTypes.BOOLEAN },
  },
})
const categoryType = new ObjectType({
  elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME),
})
const sectionType = new ObjectType({
  elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME),
})
const articleType = new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
})

const PARENT_ID = 96
const createBrandInstance = (has_help_center = true): InstanceElement =>
  new InstanceElement('brand', brandType, { id: PARENT_ID, has_help_center, subdomain: 'test' })

const createChildInstance = (
  id = 0,
  type: string,
  refType: ObjectType,
  parentKey: string,
  position?: number,
  createdAt?: string
): InstanceElement =>
  new InstanceElement(`${type}${id}`, refType, {
    [parentKey]: PARENT_ID,
    testField: 'test',
    id,
    position,
    created_at: createdAt,
  })

const createCategoryInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
  createChildInstance(id, 'category_id', categoryType, 'brand', position, createdAt)

const createSectionInCategoryInstance = (
  id = 0,
  position?: number,
  createdAt?: string
) : InstanceElement =>
  createChildInstance(id, 'section', sectionType, 'category_id', position, createdAt)

const createSectionInSectionInstance = (
  id = 0,
  position?: number,
  createdAt?: string
) : InstanceElement =>
  createChildInstance(id, 'section', sectionType, 'parent_section_id', position, createdAt)

const createArticleInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
  createChildInstance(id, 'article', articleType, 'section_id', position, createdAt)

let filter: FilterType

const testFetch = async ({ createParent, createChild, orderField }
  : {
    createParent: () => InstanceElement
    createChild: (id: number, position?: number, createdAt?: string) => InstanceElement
    orderField: string
  })
 : Promise<void> => {
  const parentInstance = createParent()
  parentInstance.value.id = PARENT_ID
  const EARLY_CREATED_AT = '2022-10-29T11:00:00Z'
  const LATE_CREATED_AT = '2022-11-30T12:00:00Z'
  const childInstances = [
    createChild(0, 0, EARLY_CREATED_AT),
    createChild(1, 0, LATE_CREATED_AT),
    createChild(2, 1, LATE_CREATED_AT),
    createChild(3, 1, EARLY_CREATED_AT)]

  const elements = [parentInstance, ...childInstances]
  await filter.onFetch(elements)

  const typeObject = GUIDE_ORDER_TYPES[parentInstance.elemID.typeName]
  const orderInstance = new InstanceElement(
    parentInstance.elemID.name,
    typeObject,
    {
      [orderField]: [childInstances[1], childInstances[0], childInstances[2], childInstances[3]]
        .map(c => new ReferenceExpression(c.elemID, c)),
    },
    [ZENDESK, RECORDS_PATH, SETTINGS_NESTED_PATH, 'GuideOrder', `order_in_${parentInstance.elemID.typeName}`]
  )

  // Sections have both sections and articles field
  if (parentInstance.elemID.typeName === SECTION_TYPE_NAME) {
    // Section_field test will also create an order element for all child sections
    if (orderField === SECTIONS_FIELD) {
      expect(elements.length).toBe(16) // All(8) x 2
      expect(elements[6]).toMatchObject(orderInstance)
    } else {
      expect(elements.length).toBe(8) // All(7) + ArticlesOrder(1)
      expect(elements[7]).toMatchObject(orderInstance)
    }
  } else {
    expect(elements.length).toBe(7) // Parent(1) + Children(4) + Type(1) + OrderElement(1)
    expect(elements[6]).toMatchObject(orderInstance)
  }

  expect(elements[5]).toBe(typeObject)
}

const testDeploy = async (
  parentInstance: InstanceElement,
  orderField: string,
  createChildElement: (id?: number) => InstanceElement,
  updateApi: configUtils.DeployRequestConfig,
  orderAdditionalField?: string,
) : Promise<void> => {
  const orderInstance = new InstanceElement(
    parentInstance.elemID.name,
    GUIDE_ORDER_TYPES[parentInstance.elemID.typeName],
    {
      [orderField]: [createChildElement(0), createChildElement(1)]
        .map(c => new ReferenceExpression(c.elemID, c)),
    },
    [ZENDESK, RECORDS_PATH, SETTINGS_NESTED_PATH, 'GuideOrder', `order_in_${parentInstance.elemID.typeName}`]
  )

  if (orderAdditionalField) {
    orderInstance.value[orderAdditionalField] = []
  }

  const change = {
    action: 'add',
    data: { after: orderInstance },
  } as Change

  const mockPut = jest.spyOn(client, 'put')
  mockPut.mockReset()
  const deployResult = await filter.deploy([change])
  expect(deployResult.deployResult.appliedChanges).toMatchObject([change])
  expect(mockPut).toHaveBeenCalledTimes(2)
  expect(mockPut).toHaveBeenCalledWith({
    url: createUrl({
      instance: createChildElement(),
      baseUrl: updateApi.url,
      urlParamsToFields: updateApi.urlParamsToFields,
    }),
    data: { position: 0 },
  })
  expect(mockPut).toHaveBeenCalledWith({
    url: createUrl({
      instance: createChildElement(1),
      baseUrl: updateApi.url,
      urlParamsToFields: updateApi.urlParamsToFields,
    }),
    data: { position: 1 },
  })
}

describe('categories order in brand', () => {
  describe('on fetch', () => {
    it('with Guide active', async () => {
      const config = DEFAULT_CONFIG
      config[FETCH_CONFIG].enableGuide = true
      filter = orderInBrandsFilter(
        createFilterCreatorParams({ config })
      ) as FilterType
      await testFetch({
        createParent: createBrandInstance,
        createChild: createCategoryInstance,
        orderField: CATEGORIES_FIELD,
      })
    })
    it('with Guide not active in Zendesk', async () => {
      const config = DEFAULT_CONFIG
      config[FETCH_CONFIG].enableGuide = true
      filter = orderInBrandsFilter(
        createFilterCreatorParams({ config })
      ) as FilterType
      // Should not create categories order field at all
      const brandWithoutGuide = createBrandInstance(false)
      const categories = [createCategoryInstance(), createCategoryInstance()]
      await filter.onFetch([brandWithoutGuide, ...categories])

      expect(brandWithoutGuide.value.categories).toBeUndefined()
    })
    it('with Guide not active in Salto', async () => {
      const config = DEFAULT_CONFIG
      config[FETCH_CONFIG].enableGuide = false
      filter = orderInBrandsFilter(
        createFilterCreatorParams({ config })
      ) as FilterType
      // Should not create categories order field at all
      const brandWithGuide = createBrandInstance()
      const categories = [createCategoryInstance(), createCategoryInstance()]
      await filter.onFetch([brandWithGuide, ...categories])

      expect(brandWithGuide.value.categories).toBeUndefined()
    })
  })

  describe('on deploy', () => {
    const updateApi = {
      url: '/api/v2/help_center/categories/{category_id}',
      method: 'put',
      deployAsField: 'category',
      urlParamsToFields: {
        category_id: 'id',
      },
    } as configUtils.DeployRequestConfig
    beforeEach(() => {
      filter = orderInBrandsFilter(createFilterCreatorParams({ client })) as FilterType
    })

    it('deploy', async () => {
      await testDeploy(
        createBrandInstance(),
        CATEGORIES_FIELD,
        createCategoryInstance,
        updateApi
      )
    })
  })
})

describe('sections order in category', () => {
  beforeEach(async () => {
    filter = orderInCategoriesFilter(createFilterCreatorParams({ client })) as FilterType
  })

  it('on fetch', async () => {
    await testFetch({
      createParent: createCategoryInstance,
      createChild: createSectionInCategoryInstance,
      orderField: SECTIONS_FIELD,
    })
  })

  describe('on deploy', () => {
    const updateApi = {
      url: '/api/v2/help_center/sections/{section_id}',
      method: 'put',
      deployAsField: 'section',
      urlParamsToFields: {
        section_id: 'id',
      },
    } as configUtils.DeployRequestConfig

    it(`with only ${SECTIONS_FIELD} order change`, async () => {
      await testDeploy(
        createCategoryInstance(),
        SECTIONS_FIELD,
        createSectionInCategoryInstance,
        updateApi
      )
    })
  })
})

describe('sections and articles order in section', () => {
  beforeEach(async () => {
    filter = orderInSectionsFilter(createFilterCreatorParams({ client })) as FilterType
  })

  it('on fetch', async () => {
    await testFetch({
      createParent: createSectionInCategoryInstance,
      createChild: createSectionInSectionInstance,
      orderField: SECTIONS_FIELD,
    })
    await testFetch({
      createParent: createSectionInCategoryInstance,
      createChild: createArticleInstance,
      orderField: ARTICLES_FIELD,
    })
  })

  describe('on deploy', () => {
    describe('section in section', () => {
      const updateApi = {
        url: '/api/v2/help_center/sections/{section_id}',
        method: 'put',
        deployAsField: 'section',
        urlParamsToFields: {
          section_id: 'id',
        },
      } as configUtils.DeployRequestConfig

      it(`with only ${SECTIONS_FIELD} order change`, async () => {
        await testDeploy(
          createSectionInCategoryInstance(1),
          SECTIONS_FIELD,
          createSectionInSectionInstance,
          updateApi,
          ARTICLES_FIELD,
        )
      })
    })
    describe('article in section', () => {
      const updateApi = {
        url: '/api/v2/help_center/articles/{articleId}',
        method: 'put',
        deployAsField: 'article',
        urlParamsToFields: {
          articleId: 'id',
        },
      } as configUtils.DeployRequestConfig

      it(`with only ${ARTICLES_FIELD} order change`, async () => {
        await testDeploy(
          createSectionInCategoryInstance(),
          ARTICLES_FIELD,
          createArticleInstance,
          updateApi,
          SECTIONS_FIELD,
        )
      })
    })
  })
})
