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
import { BuiltinTypes, Change, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { fetch as fetchUtils, filterUtils, config as configUtils } from '@salto-io/adapter-components'
import { ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK, ARTICLES_FIELD, CATEGORIES_FIELD, SECTIONS_FIELD } from '../../src/constants'
import categoryOrderFilter from '../../src/filters/guide_order/category_order'
import sectionOrderFilter from '../../src/filters/guide_order/section_order'
import articleOrderFilter from '../../src/filters/guide_order/article_order'
import { createFilterCreatorParams } from '../utils'
import { createOrderType } from '../../src/filters/guide_order/guide_order_utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'

const { createUrl } = fetchUtils.resource

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
  createdAt?: string,
  parentType?: string,
): InstanceElement =>
  new InstanceElement(`${type}${id}`, refType, {
    [parentKey]: PARENT_ID,
    testField: 'test',
    id,
    position,
    created_at: createdAt,
    direct_parent_type: parentType,
  })

const createCategoryInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
  createChildInstance(id, 'category_id', categoryType, 'brand', position, createdAt)

const createSectionInCategoryInstance = (
  id = 0,
  position?: number,
  createdAt?: string
) : InstanceElement =>
  createChildInstance(id, 'section', sectionType, 'category_id', position, createdAt, CATEGORY_TYPE_NAME)

const createSectionInSectionInstance = (
  id = 0,
  position?: number,
  createdAt?: string
) : InstanceElement =>
  createChildInstance(id, 'section', sectionType, 'parent_section_id', position, createdAt, SECTION_TYPE_NAME)

const createArticleInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
  createChildInstance(id, 'article', articleType, 'section_id', position, createdAt)

let filter: FilterType

const testFetch = async ({ createParent, createChild, orderField }
: {
  createParent: () => InstanceElement
  createChild: (id: number,
                position?: number,
                createdAt?: string,
                promoted?: boolean) => InstanceElement
  orderField: string
  })
 : Promise<void> => {
  const parentInstance = createParent()
  parentInstance.value.id = PARENT_ID
  const EARLY_CREATED_AT = '2022-10-29T11:00:00Z'
  const LATE_CREATED_AT = '2022-11-30T12:00:00Z'
  const childInstances = [
    createChild(0, 1, EARLY_CREATED_AT),
    createChild(1, 0, EARLY_CREATED_AT),
    createChild(1, 0, LATE_CREATED_AT),
    createChild(1, 0, LATE_CREATED_AT),
  ]

  const sortedOrder = [childInstances[3], childInstances[2], childInstances[1], childInstances[0]]

  // In articles, we also check 'promoted' field, if its true the article should be first
  if (orderField === ARTICLES_FIELD) {
    const promotedArticle = createChild(2, 2, EARLY_CREATED_AT)
    promotedArticle.value.promoted = true
    childInstances.forEach(child => { child.value.promoted = false })

    childInstances.push(promotedArticle)
    sortedOrder.unshift(promotedArticle)
  }

  const elements = [parentInstance, ...childInstances]
  await filter.onFetch(elements)

  const typeObject = createOrderType(childInstances[0].elemID.typeName)
  const orderInstance = new InstanceElement(
    parentInstance.elemID.name,
    typeObject,
    {
      // Sort by position -> later createAt -> later id
      [orderField]: sortedOrder.map(c => new ReferenceExpression(c.elemID, c)),
    },
    parentInstance.path !== undefined
      ? [...parentInstance.path.slice(0, -1), typeObject.elemID.typeName]
      : undefined,
  )

  // with Article_field we added another article to make sure promoted articles are first
  if (orderField === ARTICLES_FIELD) {
    expect(elements.length).toBe(8) // All(7) + PromotedArticle(1)
    expect(elements[7]).toMatchObject(orderInstance)
    expect(elements[6]).toMatchObject(typeObject)
    return
  }

  // Section_field tests will also create an order element for all child sections
  if (orderField === SECTIONS_FIELD) {
    expect(elements.length).toBe(11) // All(7) + ChildrenOrders(4)
  } else {
    expect(elements.length).toBe(7) // Parent(1) + Children(4) + Type(1) + OrderElement(1)
  }

  expect(elements[6]).toMatchObject(orderInstance)
  expect(elements[5]).toMatchObject(typeObject)
}

const testDeploy = async (
  parentInstance: InstanceElement,
  orderField: string,
  createChildElement: (id?: number) => InstanceElement,
  updateApi: configUtils.DeployRequestConfig,
) : Promise<void> => {
  const children = [createChildElement(0), createChildElement(1)]
  const orderInstance = new InstanceElement(
    parentInstance.elemID.name,
    createOrderType(children[0].elemID.typeName),
    {
      [orderField]: children.map(c => new ReferenceExpression(c.elemID, c)),
    },
    parentInstance.path && [...parentInstance.path.slice(0, -1), `${orderField}_order`],
  )

  const change = {
    action: 'add',
    data: { after: orderInstance },
  } as Change

  const mockPut = jest.spyOn(client, 'put')
  mockPut.mockReset()
  const deployResult = await filter.deploy([change])
  expect(deployResult.deployResult.appliedChanges).toMatchObject([change])
  expect(deployResult.leftoverChanges.length).toBe(0)
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

const config = { ...DEFAULT_CONFIG }

describe('Categories order in brand', () => {
  describe('on fetch', () => {
    it('with Guide active in Zendesk And Salto', async () => {
      config[FETCH_CONFIG].guide = {
        brands: ['.*'],
      }
      filter = categoryOrderFilter(
        createFilterCreatorParams({ config })
      ) as FilterType
      await testFetch({
        createParent: createBrandInstance,
        createChild: createCategoryInstance,
        orderField: CATEGORIES_FIELD,
      })
    })
    it('with Guide not active in Zendesk', async () => {
      config[FETCH_CONFIG].guide = {
        brands: ['.*'],
      }
      filter = categoryOrderFilter(
        createFilterCreatorParams({ config })
      ) as FilterType
      // Should not create categories order field at all
      const brandWithoutGuide = createBrandInstance(false)
      const categories = [createCategoryInstance(), createCategoryInstance()]
      await filter.onFetch([brandWithoutGuide, ...categories])

      expect(brandWithoutGuide.value.categories).toBeUndefined()
    })
    it('with Guide not active in Salto', async () => {
      config[FETCH_CONFIG].guide = undefined
      filter = categoryOrderFilter(
        createFilterCreatorParams({})
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
      filter = categoryOrderFilter(createFilterCreatorParams({ client })) as FilterType
    })

    it('deploy', async () => {
      await testDeploy(
        createBrandInstance(),
        CATEGORIES_FIELD,
        createCategoryInstance,
        updateApi,
      )
    })
  })
})

describe('Sections order in category', () => {
  beforeEach(async () => {
    config[FETCH_CONFIG].guide = {
      brands: ['.*'],
    }
    filter = sectionOrderFilter(createFilterCreatorParams({ client })) as FilterType
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

    it('deploy', async () => {
      await testDeploy(
        createCategoryInstance(),
        SECTIONS_FIELD,
        createSectionInCategoryInstance,
        updateApi,
      )
    })
  })
})

describe('Sections order in section', () => {
  beforeEach(async () => {
    config[FETCH_CONFIG].guide = {
      brands: ['.*'],
    }
    filter = sectionOrderFilter(createFilterCreatorParams({ client })) as FilterType
  })

  it('on fetch', async () => {
    await testFetch({
      createParent: createSectionInCategoryInstance,
      createChild: createSectionInSectionInstance,
      orderField: SECTIONS_FIELD,
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

      it('deploy', async () => {
        await testDeploy(
          createSectionInCategoryInstance(1),
          SECTIONS_FIELD,
          createSectionInSectionInstance,
          updateApi,
        )
      })
    })
  })
})

describe('Articles order in section', () => {
  beforeEach(async () => {
    config[FETCH_CONFIG].guide = {
      brands: ['.*'],
    }
    filter = articleOrderFilter(createFilterCreatorParams({ client })) as FilterType
  })

  it('on fetch', async () => {
    await testFetch({
      createParent: createSectionInCategoryInstance,
      createChild: createArticleInstance,
      orderField: ARTICLES_FIELD,
    })
  })

  describe('on deploy', () => {
    const updateApi = {
      url: '/api/v2/help_center/articles/{articleId}',
      method: 'put',
      deployAsField: 'article',
      urlParamsToFields: {
        articleId: 'id',
      },
    } as configUtils.DeployRequestConfig

    it('deploy', async () => {
      await testDeploy(
        createSectionInCategoryInstance(),
        ARTICLES_FIELD,
        createArticleInstance,
        updateApi,
      )
    })
  })
})
