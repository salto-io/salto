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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { BRAND_TYPE_NAME, ZENDESK, CATEGORIES_FIELD } from '../../src/constants'
import filterCreator from '../../src/filters/remove_brand_logo_field'
import { LOGO_FIELD, BRAND_LOGO_TYPE } from '../../src/filters/brand_logo'
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

describe('remove brand logo field filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    fields: {
      [LOGO_FIELD]: { refType: new ObjectType(BRAND_LOGO_TYPE) },
    },
  })
  const brandId = 11
  const logoId = 111
  const filename = 'brand1_logo.png'
  const brandInstance = new InstanceElement('brand', brandType, {
    id: brandId,
    name: 'test',
    active: true,
    [LOGO_FIELD]: {
      content_type: 'image/png',
      content_url: `https://company.zendesk.com/system/brands/${logoId}/brand1_logo.png`,
      file_name: filename,
      id: logoId,
    },
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  it('should pass the correct params to deployChange and client on create', async () => {
    const clonedBrand = brandInstance.clone()
    mockDeployChange.mockImplementation(async () => ({ brand: { brandId } }))
    const res = await filter.deploy([{ action: 'add', data: { after: clonedBrand } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedBrand } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: [LOGO_FIELD, CATEGORIES_FIELD],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedBrand } }])
  })
  it('should pass the correct params to deployChange and client on modify', async () => {
    const clonedBeforeBrand = brandInstance.clone()
    const clonedAfterBrand = brandInstance.clone()
    delete clonedBeforeBrand.value.intervals
    clonedAfterBrand.value.name = 'modified_name'
    clonedBeforeBrand.value.id = brandId
    clonedAfterBrand.value.id = brandId
    mockDeployChange.mockImplementation(async () => ({ brand: { brandId } }))
    const res = await filter.deploy([
      { action: 'modify', data: { before: clonedBeforeBrand, after: clonedAfterBrand } },
    ])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'modify', data: { before: clonedBeforeBrand, after: clonedAfterBrand } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: [LOGO_FIELD, CATEGORIES_FIELD],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toEqual([
      { action: 'modify', data: { before: clonedBeforeBrand, after: clonedAfterBrand } },
    ])
  })
  it('should pass the correct params to deployChange and client on remove', async () => {
    const clonedBrand = brandInstance.clone()
    clonedBrand.value.id = brandId
    mockDeployChange.mockImplementation(async () => ({ brand: { brandId } }))
    const res = await filter.deploy([{ action: 'remove', data: { before: clonedBrand } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'remove', data: { before: clonedBrand } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: [LOGO_FIELD, CATEGORIES_FIELD],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toEqual([{ action: 'remove', data: { before: clonedBrand } }])
  })
  it('should return error if deployChange failed', async () => {
    const clonedBrand = brandInstance.clone()
    mockDeployChange.mockImplementation(async () => {
      throw new Error('err')
    })
    const res = await filter.deploy([{ action: 'add', data: { after: clonedBrand } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedBrand } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: [LOGO_FIELD, CATEGORIES_FIELD],
    })
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
})
