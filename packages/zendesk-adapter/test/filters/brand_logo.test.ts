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
import FormData from 'form-data'
import {
  ObjectType, ElemID, InstanceElement, isInstanceElement, StaticFile, ReferenceExpression,
  CORE_ANNOTATIONS, getChangeData,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator, { BRAND_LOGO_TYPE, LOGO_FIELD } from '../../src/filters/brand_logo'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { BRAND_LOGO_TYPE_NAME, BRAND_NAME, ZENDESK_SUPPORT } from '../../src/constants'

jest.useFakeTimers()

describe('brand logo filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  let mockPut: jest.SpyInstance
  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, BRAND_NAME),
    fields: {
      [LOGO_FIELD]: { refType: new ObjectType(BRAND_LOGO_TYPE) },
    },
  })
  const brandId = 11
  const logoId = 111
  const logoType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, BRAND_LOGO_TYPE_NAME),
  })
  const filename = 'brand1_logo.png'
  const content = Buffer.from('test')
  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('onFetch', () => {
    let brandInstance: InstanceElement
    beforeEach(() => {
      brandInstance = new InstanceElement(
        'brand',
        brandType,
        {
          id: brandId,
          name: 'test',
          active: true,
          [LOGO_FIELD]: {
            content_type: 'image/png',
            content_url: `https://company.zendesk.com/system/brands/${logoId}/brand1_logo.png`,
            file_name: filename,
            id: logoId,
          },
        },
      )
      mockGet = jest.spyOn(client, 'getResource')
      mockGet.mockImplementation(params => {
        if (params.url === `/brands/${logoId}/brand1_logo.png`) {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
    })
    it('should create brand logos instances', async () => {
      const elements = [brandType, brandInstance].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.brand',
          'zendesk_support.brand.instance.brand',
          'zendesk_support.brand_logo',
          'zendesk_support.brand_logo.instance.test__brand1_logo_png@uuuv',
        ])
    })
    it('should create a new logo instance', async () => {
      const elements = [brandType, brandInstance].map(e => e.clone())
      await filter.onFetch(elements)

      const instances = elements.filter(isInstanceElement)
      const logo = instances.find(e => e.elemID.typeName === BRAND_LOGO_TYPE_NAME)
      expect(logo?.value).toEqual({
        id: logoId,
        filename,
        contentType: 'image/png',
        content: new StaticFile({
          filepath: 'zendesk_support/brand_logo/test__brand1_logo.png', encoding: 'binary', content,
        }),
      })
    })
    it('should update the brand instance', async () => {
      const elements = [brandType, brandInstance].map(e => e.clone())
      await filter.onFetch(elements)

      const instances = elements.filter(isInstanceElement)
      const brand = instances.find(e => e.elemID.typeName === BRAND_NAME)
      const logo = instances.find(
        e => e.elemID.typeName === BRAND_LOGO_TYPE_NAME
      ) as InstanceElement
      expect(brand?.value).toEqual({
        ...brandInstance.value,
        [LOGO_FIELD]: new ReferenceExpression(logo.elemID, logo),
      })
    })
  })

  describe('deploy', () => {
    let logoInstance: InstanceElement
    let brandInstance: InstanceElement
    beforeEach(() => {
      logoInstance = new InstanceElement(
        'brand_logo',
        logoType,
        {
          id: logoId,
          filename: 'test.png',
          contentType: 'image/png',
          content: new StaticFile({
            filepath: 'zendesk_support/brand_logo/test__test.png', encoding: 'binary', content,
          }),
        },
      )
      brandInstance = new InstanceElement(
        'brand',
        brandType,
        {
          id: brandId,
          name: 'test',
          active: true,
          [LOGO_FIELD]: new ReferenceExpression(logoInstance.elemID, logoInstance),
        },
      )
      logoInstance.annotate({
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brandInstance.elemID, brandInstance)],
      })
    })
    it('should add logo instances', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = logoInstance.clone()
      mockPut = jest.spyOn(client, 'put')
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedBrand } },
        { action: 'add', data: { after: clonedLogo } },
      ])
      const resolvedClonedBrand = clonedBrand.clone()
      resolvedClonedBrand.value[LOGO_FIELD] = [logoId]
      resolvedClonedBrand.value.id = brandId

      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })

      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value)
        .toEqual(clonedBrand.value)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'add', data: { after: clonedLogo } }
      )
    })
    it('should modify logo instances', async () => {
      const beforeLogo = logoInstance.clone()
      const afterLogo = logoInstance.clone()
      afterLogo.value.content = new StaticFile({
        filepath: 'zendesk_support/brand_logo/test__test2.png',
        encoding: 'binary',
        content: Buffer.from('changes!'),
      })
      mockPut = jest.spyOn(client, 'put')
      const res = await filter.deploy([
        { action: 'modify', data: { before: beforeLogo, after: afterLogo } },
      ])

      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })

      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'modify', data: { before: beforeLogo, after: afterLogo } }
      )
    })
    it('should remove logo instances', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = logoInstance.clone()
      mockPut = jest.spyOn(client, 'put')
      const res = await filter.deploy([
        { action: 'remove', data: { before: clonedBrand } },
        { action: 'remove', data: { before: clonedLogo } },
      ])
      const resolvedClonedBrand = clonedBrand.clone()
      resolvedClonedBrand.value[LOGO_FIELD] = [logoId]
      resolvedClonedBrand.value.id = brandId

      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })

      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value)
        .toEqual(clonedBrand.value)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'remove', data: { before: clonedLogo } }
      )
    })
  })
})
