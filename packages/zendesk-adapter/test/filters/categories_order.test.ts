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
  ObjectType, ElemID, InstanceElement, BuiltinTypes, ReferenceExpression, Change,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { BRAND_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator, { CATEGORIES_FIELD } from '../../src/filters/brands_filter'
import { LOGO_FIELD } from '../../src/filters/brand_logo'
import { createFilterCreatorParams } from '../utils'

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

describe('categories order in brand', () => {
    type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
    let filter: FilterType
    const brandType = new ObjectType({
      elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
      fields: {
        has_help_center: { refType: BuiltinTypes.BOOLEAN },
      },
    })
    const categoryType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'category'),
      fields: {
        brand: { refType: BuiltinTypes.NUMBER },
      },
    })
    const BRAND_ID = 96
    const createBrandInstance = (has_help_center = true): InstanceElement =>
      new InstanceElement('brand', brandType, { id: BRAND_ID, has_help_center, subdomain: 'test' })

    const createCategory = (): InstanceElement =>
      new InstanceElement('category', categoryType, { brand: BRAND_ID, testField: 'test' })

    const regularDeployChangeParam = (change: Change) : {} => ({
      change,
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: [LOGO_FIELD, 'categories'],
    })

    const categoryDeployChangeParam = (change: Change) : {} => ({
      change,
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['brand', 'testField'],
    })


    beforeEach(async () => {
      jest.clearAllMocks()
      filter = filterCreator(createFilterCreatorParams({})) as FilterType
    })

    describe('on fetch', () => {
      it('with Guide active', async () => {
        // Should create categories order field
        const brandWithGuide = createBrandInstance()
        const categories = [createCategory(), createCategory()]
        await filter.onFetch([brandWithGuide, ...categories])
        expect(brandWithGuide.value.categories.length).toBe(2)
        expect(brandWithGuide.value.categories)
          .toMatchObject(categories.map(c => new ReferenceExpression(c.elemID, c)))
      })
      it('with Guide not active', async () => {
        // Should not create categories order field at all
        const brandWithoutGuide = createBrandInstance(false)
        const categories = [createCategory(), createCategory()]
        await filter.onFetch([brandWithoutGuide, ...categories])
        expect(brandWithoutGuide.value.categories).toBeUndefined()
      })
    })

    describe('on deploy', () => {
      const beforeBrand = createBrandInstance()

      const firstCategory = createCategory()
      const secondCategory = createCategory()

      const beforeCategory = firstCategory.clone()

      const afterFirstCategory = firstCategory.clone()
      const afterSecondCategory = firstCategory.clone()
      afterFirstCategory.value.position = 0
      afterSecondCategory.value.position = 1

      beforeBrand.value.categories = [firstCategory, secondCategory].map(
        c => new ReferenceExpression(c.elemID, c)
      )

      beforeEach(() => {
        delete firstCategory.value.position
        delete secondCategory.value.position
      })

      it(`with only ${CATEGORIES_FIELD} order change`, async () => {
        // should deploy categories position change and not return appliedChanges
        const afterBrand = beforeBrand.clone()
        afterBrand.value.categories = [secondCategory, firstCategory].map(
          c => new ReferenceExpression(c.elemID, c)
        )

        mockDeployChange.mockImplementation(async () => ({ appliedChanges: ['change'] }))
        const res = await filter.deploy([{
          action: 'modify',
          data: { before: beforeBrand, after: afterBrand },
        }])

        expect(mockDeployChange).toHaveBeenCalledTimes(3)
        expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeCategory, after: afterFirstCategory } }))
        expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeCategory, after: afterSecondCategory } }))
        expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeBrand, after: afterBrand } }))
        expect(res.deployResult.appliedChanges).toHaveLength(1)
      })

      it(`with ${CATEGORIES_FIELD} change and regular change`, async () => {
        // should deploy categories position change and regular deploy, and return appliedChanges
        const afterBrand = beforeBrand.clone()
        const modifyBrand = beforeBrand.clone()

        afterBrand.value.categories = [secondCategory, firstCategory].map(
          c => new ReferenceExpression(c.elemID, c)
        )
        afterBrand.value.subdomain = 'changed'

        const res = await filter.deploy([
          { action: 'modify', data: { before: beforeBrand, after: afterBrand } },
          { action: 'modify', data: { before: beforeBrand, after: modifyBrand } },
        ])

        expect(mockDeployChange).toHaveBeenCalledTimes(4)
        expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeCategory, after: afterFirstCategory } }))
        expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeCategory, after: afterSecondCategory } }))
        expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeBrand, after: afterBrand } }))
        expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeBrand, after: modifyBrand } }))
        expect(res.deployResult.appliedChanges).toHaveLength(2)
      })

      it('with only non-order changes', async () => {
        // should not deploy categories position change, should return appliedChanges
        const afterBrand = beforeBrand.clone()
        afterBrand.value.categories = [firstCategory, secondCategory].map(
          c => new ReferenceExpression(c.elemID, c)
        )
        afterBrand.value.subdomain = 'changed'

        mockDeployChange.mockImplementation(async () => ({ appliedChanges: ['change'] }))
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
