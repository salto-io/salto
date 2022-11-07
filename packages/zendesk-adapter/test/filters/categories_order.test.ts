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
import {
  ObjectType,
  ElemID,
  InstanceElement,
  BuiltinTypes,
  ReferenceExpression,
  Change,
  ReadOnlyElementsSource,
  Element,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, ZENDESK } from '../../src/constants'
import brandOrderFilter from '../../src/filters/brands_filter'
import { LOGO_FIELD } from '../../src/filters/brand_logo'
import { createFilterCreatorParams } from '../utils'
import { CATEGORIES_FIELD } from '../../src/filters/guide_order_utils'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})
mockDeployChange.mockImplementation(async () => ({ appliedChanges: ['change'] }))

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
// const sectionType = new ObjectType({
//   elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME),
//   fields: {
//     has_help_center: { refType: BuiltinTypes.BOOLEAN },
//   },
// })
// const articleType = new ObjectType({
//   elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
//   fields: {
//     has_help_center: { refType: BuiltinTypes.BOOLEAN },
//   },
// })

const regularDeployChangeParam = (change: Change) : {} => ({
  change,
  fieldsToIgnore: [LOGO_FIELD, 'categories'],
  client: expect.anything(),
  endpointDetails: expect.anything(),
})

const categoryDeployChangeParam = (change: Change) : {} => ({
  change,
  client: expect.anything(),
  endpointDetails: expect.anything(),
})

const removeNonRelevantFields = (categories: InstanceElement[]) : void => {
  categories.forEach(c => { c.value = { id: c.value.id, position: c.value.position } })
}

const BRAND_ID = 96
const createBrandInstance = (has_help_center = true): InstanceElement =>
  new InstanceElement('brand', brandType, { id: BRAND_ID, has_help_center, subdomain: 'test' })

const createChildInstance = (
  id = 0,
  type: string,
  refType: ObjectType,
  position?: number,
  createdAt?: string
): InstanceElement =>
  new InstanceElement(`${type}${id}`, refType, {
    brand: BRAND_ID,
    testField: 'test',
    id,
    position,
    created_at: createdAt,
  })

const createCategoryInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
  createChildInstance(id, 'category', categoryType, position, createdAt)

// const createSectionInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
//   createChildInstance(id, 'section', sectionType, position, createdAt)
//
// const createArticleInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
//   createChildInstance(id, 'article', articleType, position, createdAt)

let filter: FilterType
let elementsSourceValues: Element[] = []
const elementsSource = {
  get: (elemId: ElemID) => elementsSourceValues.find(
    v => v.elemID.getFullName() === elemId.getFullName()
  ),
} as unknown as ReadOnlyElementsSource

const testFetch = async (
  {
    fatherCreateInstance,
    childCreateInstance,
    orderField,
  }
  : {
    fatherCreateInstance: () => InstanceElement
    childCreateInstance: (id: number, position?: number, createdAt?: string) => InstanceElement
    orderField: string
  })
 : Promise<void> => {
  const fatherInstance = fatherCreateInstance()
  const EARLY_CREATED_AT = '2022-10-29T11:00:00Z'
  const LATE_CREATED_AT = '2022-11-30T12:00:00Z'
  const childInstances = [
    childCreateInstance(0, 0, EARLY_CREATED_AT),
    childCreateInstance(1, 0, LATE_CREATED_AT),
    childCreateInstance(2, 1, LATE_CREATED_AT),
    childCreateInstance(3, 1, EARLY_CREATED_AT)]

  await filter.onFetch([fatherInstance, ...childInstances])

  expect(fatherInstance.value[orderField].length).toBe(4)
  expect(fatherInstance.value[orderField])
    .toMatchObject([childInstances[1], childInstances[0], childInstances[2], childInstances[3]]
      .map(c => new ReferenceExpression(c.elemID, c)))
}

describe('categories order in brand', () => {
  beforeEach(async () => {
    filter = brandOrderFilter(createFilterCreatorParams({ elementsSource })) as FilterType
  })

  describe('on fetch', () => {
    it('with Guide active', async () => {
      await testFetch({
        fatherCreateInstance: createBrandInstance,
        childCreateInstance: createCategoryInstance,
        orderField: CATEGORIES_FIELD,
      })
    })
    it('with Guide not active', async () => {
      // Should not create categories order field at all
      const brandWithoutGuide = createBrandInstance(false)
      const categories = [createCategoryInstance(), createCategoryInstance()]
      await filter.onFetch([brandWithoutGuide, ...categories])

      expect(brandWithoutGuide.value.categories).toBeUndefined()
    })
  })

  describe('on deploy', () => {
    const beforeBrand = createBrandInstance()
    const FIRST_ID = 0
    const SECOND_ID = 1

    const firstCategory = createCategoryInstance(FIRST_ID)
    const secondCategory = createCategoryInstance(SECOND_ID)

    const beforeFirstCategory = createCategoryInstance(FIRST_ID, 0)
    const beforeSecondCategory = createCategoryInstance(SECOND_ID, 1)
    const afterFirstCategory = createCategoryInstance(FIRST_ID, 1)
    const afterSecondCategory = createCategoryInstance(SECOND_ID, 0)

    // The code shouldn't deploy non-relevant fields, so we remove them from the result elements
    removeNonRelevantFields([
      beforeFirstCategory,
      beforeSecondCategory,
      afterFirstCategory,
      afterSecondCategory,
    ])

    beforeBrand.value.categories = [firstCategory, secondCategory].map(
      c => new ReferenceExpression(c.elemID, c)
    )

    beforeEach(() => {
      mockDeployChange.mockReset()

      firstCategory.value.position = 0
      secondCategory.value.position = 1
      elementsSourceValues = [firstCategory, secondCategory]
    })

    it(`with only ${CATEGORIES_FIELD} order change`, async () => {
      // should deploy categories position change and not return appliedChanges
      const afterBrand = beforeBrand.clone()
      afterBrand.value.categories = [secondCategory, firstCategory].map(
        c => new ReferenceExpression(c.elemID, c)
      )
      elementsSourceValues.push(afterBrand)

      const res = await filter.deploy([{
        action: 'modify',
        data: { before: beforeBrand, after: afterBrand },
      }])


      expect(mockDeployChange).toHaveBeenCalledTimes(3)
      expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeSecondCategory, after: afterSecondCategory } }))
      expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeFirstCategory, after: afterFirstCategory } }))
      expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeBrand, after: afterBrand } }))
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })

    it(`with ${CATEGORIES_FIELD} change and regular change`, async () => {
      // should deploy categories position change and regular deploy, and return appliedChanges
      const afterBrand = beforeBrand.clone()
      afterBrand.value.categories = [secondCategory, firstCategory].map(
        c => new ReferenceExpression(c.elemID, c)
      )
      afterBrand.value.subdomain = 'changed'
      elementsSourceValues.push(afterBrand)

      const res = await filter.deploy([
        { action: 'modify', data: { before: beforeBrand, after: afterBrand } },
      ])

      expect(mockDeployChange).toHaveBeenCalledTimes(3)
      expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeFirstCategory, after: afterFirstCategory } }))
      expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeSecondCategory, after: afterSecondCategory } }))
      expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeBrand, after: afterBrand } }))
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })

    it('with only non-order changes', async () => {
      // should not deploy categories position change, should return appliedChanges
      const afterBrand = beforeBrand.clone()
      afterBrand.value.categories = [firstCategory, secondCategory].map(
        c => new ReferenceExpression(c.elemID, c)
      )
      afterBrand.value.subdomain = 'changed'

      const res = await filter.deploy([
        { action: 'add', data: { after: beforeBrand } },
        { action: 'remove', data: { before: beforeBrand } },
        { action: 'modify', data: { before: beforeBrand, after: afterBrand } },
      ])

      expect(mockDeployChange).toHaveBeenCalledTimes(3)
      expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'add', data: { after: beforeBrand } }))
      expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'remove', data: { before: beforeBrand } }))
      expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeBrand, after: afterBrand } }))
      expect(res.deployResult.appliedChanges).toHaveLength(3)
    })
  })
})
//
// describe('sections order in category', () => {
//   beforeEach(async () => {
//     filter = categoriesOrderFilter(createFilterCreatorParams({ elementsSource })) as FilterType
//   })
//
//   it('on fetch', async () => {
//     // await testFetch({
//     //   fatherCreateInstance: createSectionInstance,
//     //   childCreateInstance: createArticleInstance,
//     //   orderField: SECTIONS_FIELD,
//     // })
//   })
//
//   describe('on deploy', () => {
//     beforeEach(() => {
//     })
//
//     it(`with only ${SECTIONS_FIELD} order change`, async () => {
//     })
//
//     it(`with ${SECTIONS_FIELD} change and regular change`, async () => {
//     })
//
//     it('with only non-order changes', async () => {
//     })
//   })
// })
//
// describe('sections and articles order in section', () => {
//   beforeEach(async () => {
//     filter = sectionsOrderFilter(createFilterCreatorParams({ elementsSource })) as FilterType
//   })
//
//   it('on fetch', async () => {
//   })
//
//   describe('on deploy', () => {
//     beforeEach(() => {
//     })
//
//     it(`with only ${SECTIONS_FIELD} and ${ARTICLES_FIELD} order change`, async () => {
//     })
//
//     it('with order change and regular change', async () => {
//     })
//
//     it('with only non-order changes', async () => {
//     })
//   })
// })
