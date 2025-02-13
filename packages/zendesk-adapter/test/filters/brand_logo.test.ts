/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import FormData from 'form-data'
import {
  ObjectType,
  ElemID,
  Element,
  InstanceElement,
  isInstanceElement,
  StaticFile,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  getChangeData,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { createSaltoElementError } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import filterCreator, { LOGO_FIELD } from '../../src/filters/brand_logo'
import ZendeskClient from '../../src/client/client'
import { BRAND_LOGO_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'

jest.useFakeTimers()

describe('brand logo filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  let mockBrandGet: jest.SpyInstance
  let mockPut: jest.SpyInstance
  const brandLogoType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_LOGO_TYPE_NAME),
    fields: {
      filename: { refType: BuiltinTypes.STRING },
      contentType: { refType: BuiltinTypes.STRING },
      content: { refType: BuiltinTypes.STRING },
    },
  })
  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    fields: {
      [LOGO_FIELD]: { refType: brandLogoType },
    },
  })
  const brandId = 11
  const logoId = 111
  const logoType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_LOGO_TYPE_NAME),
  })
  const filename = 'brand1_logo.png'
  const content = Buffer.from('test')
  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('onFetch', () => {
    let brandInstance: InstanceElement
    let elements: Element[]
    beforeEach(() => {
      brandInstance = new InstanceElement('brand', brandType, {
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
      mockGet = jest.spyOn(client, 'getResource')
      mockGet.mockImplementation(params => {
        if (params.url === `/system/brands/${logoId}/brand1_logo.png`) {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
      elements = [brandType, brandInstance, brandLogoType].map(e => e.clone())
    })
    it('should create brand logos instances', async () => {
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.brand',
        'zendesk.brand.instance.brand',
        'zendesk.brand_logo',
        'zendesk.brand_logo.instance.test__brand1_logo_png@uuuv',
      ])
    })
    it('should create a new logo instance', async () => {
      await filter.onFetch(elements)

      const instances = elements.filter(isInstanceElement)
      const logo = instances.find(e => e.elemID.typeName === BRAND_LOGO_TYPE_NAME)
      expect(logo?.value).toEqual({
        id: logoId,
        filename,
        contentType: 'image/png',
        content: new StaticFile({
          filepath: 'zendesk/brand_logo/test__brand1_logo.png',
          encoding: 'binary',
          content,
        }),
      })
    })
    it('should update the brand instance', async () => {
      await filter.onFetch(elements)

      const instances = elements.filter(isInstanceElement)
      const brand = instances.find(e => e.elemID.typeName === BRAND_TYPE_NAME)
      const logo = instances.find(e => e.elemID.typeName === BRAND_LOGO_TYPE_NAME) as InstanceElement
      expect(brand?.value).toEqual({
        ...brandInstance.value,
        [LOGO_FIELD]: new ReferenceExpression(logo.elemID, logo),
      })
    })
    it('should return fetch warning in case of 403 error and remove logo field from brand', async () => {
      mockGet.mockImplementation(_params => {
        throw new clientUtils.HTTPError('err', { data: 'err' as unknown as clientUtils.ResponseValue, status: 403 })
      })
      const res = (await filter.onFetch(elements)) as unknown as filterUtils.FilterResult
      expect(res.errors).toHaveLength(1)
      expect(res.errors).toEqual([
        {
          message: 'Other issues',
          detailedMessage:
            "Salto could not access the brand_logo resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource",
          severity: 'Info',
        },
      ])
      const brand = elements.filter(isInstanceElement).find(e => e.elemID.typeName === BRAND_TYPE_NAME)
      expect(brand?.value[LOGO_FIELD]).toBeUndefined()
    })
    it('should throw error on any other error', async () => {
      mockGet.mockImplementation(_params => {
        throw new Error('err')
      })
      await expect(filter.onFetch(elements)).rejects.toThrow()
    })
    it('should not create instances if brand logo type is not found', async () => {
      elements = [brandType, brandInstance].map(e => e.clone())
      const res = await filter.onFetch(elements)
      expect(res).toEqual({ errors: [] })
    })
  })

  describe('deploy', () => {
    let logoInstance: InstanceElement
    let brandInstance: InstanceElement
    beforeEach(() => {
      mockGet = jest.spyOn(client, 'getResource')
      mockGet.mockImplementation(params => {
        if (params.url === `/system/brands/${logoId}/test.png`) {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
      mockBrandGet = jest.spyOn(client, 'get')
      mockBrandGet.mockImplementation(params => {
        if (params.url === `/api/v2/brands/${brandId}`) {
          return {
            status: 200,
            data: { brand: { logo: { id: logoId } } },
          }
        }
        throw new Error('Err')
      })
      logoInstance = new InstanceElement('brand_logo', logoType, {
        id: logoId,
        filename: 'test.png',
        contentType: 'image/png',
        content: new StaticFile({
          filepath: 'zendesk/brand_logo/test__test.png',
          encoding: 'binary',
          content,
        }),
      })
      brandInstance = new InstanceElement('brand', brandType, {
        id: brandId,
        name: 'test',
        active: true,
        [LOGO_FIELD]: new ReferenceExpression(logoInstance.elemID, logoInstance),
      })
      logoInstance.annotate({
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brandInstance.elemID, brandInstance)],
      })
    })
    it('should add logo instances (multiple retries)', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = logoInstance.clone()
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: logoId, file_name: 'test.png' } } }, status: 201 })
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedBrand } },
        { action: 'add', data: { after: clonedLogo } },
      ])
      const resolvedClonedBrand = clonedBrand.clone()
      resolvedClonedBrand.value[LOGO_FIELD] = [logoId]
      resolvedClonedBrand.value.id = brandId

      expect(mockPut).toHaveBeenCalledTimes(5)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/api/v2/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })
      expect(mockBrandGet).toHaveBeenCalledTimes(5)

      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(clonedBrand.value)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({ action: 'add', data: { after: clonedLogo } })
    })
    it('should modify logo instances', async () => {
      const beforeLogo = logoInstance.clone()
      const afterLogo = logoInstance.clone()
      afterLogo.value.content = new StaticFile({
        filepath: 'zendesk/brand_logo/test__test2.png',
        encoding: 'binary',
        content: Buffer.from('changes!'),
      })
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: logoId, file_name: 'test.png' } } }, status: 201 })
      const res = await filter.deploy([{ action: 'modify', data: { before: beforeLogo, after: afterLogo } }])

      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/api/v2/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })

      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({
        action: 'modify',
        data: { before: beforeLogo, after: afterLogo },
      })
    })
    it('should remove logo instances', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = logoInstance.clone()
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: logoId, file_name: 'test.png' } } }, status: 201 })
      const res = await filter.deploy([
        { action: 'remove', data: { before: clonedBrand } },
        { action: 'remove', data: { before: clonedLogo } },
      ])

      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/api/v2/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })

      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(clonedBrand.value)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({ action: 'remove', data: { before: clonedLogo } })
    })
    it('should fail deploy in case of reaching maximum retries limit', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = logoInstance.clone()
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      mockPut.mockResolvedValueOnce({ data: { brand: { logo: { id: 666, file_name: 'wrongFile.png' } } }, status: 201 })
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedBrand } },
        { action: 'add', data: { after: clonedLogo } },
      ])

      expect(mockPut).toHaveBeenCalledTimes(5)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/api/v2/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })
      expect(mockBrandGet).toHaveBeenCalledTimes(5)

      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual(
        createSaltoElementError({
          message: `Can't deploy ${logoInstance.elemID.name} of the type brand_logo, due to Zendesk's API limitations. Please upload it manually in Zendesk Admin Center`,
          detailedMessage: `Can't deploy ${logoInstance.elemID.name} of the type brand_logo, due to Zendesk's API limitations. Please upload it manually in Zendesk Admin Center`,
          severity: 'Error',
          elemID: clonedLogo.elemID,
        }),
      )

      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(clonedBrand.value)
    })
    it('should fail deploy in case of not abling to re-fetch the brand (reaching maximum retries limit)', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = logoInstance.clone()
      mockPut = jest.spyOn(client, 'put')
      mockPut.mockResolvedValue({ data: { brand: { logo: { id: logoId, file_name: 'test.png' } } }, status: 201 })
      mockBrandGet.mockReturnValueOnce(undefined)
      mockBrandGet.mockReturnValueOnce(undefined)
      mockBrandGet.mockReturnValueOnce(undefined)
      mockBrandGet.mockReturnValueOnce(undefined)
      mockBrandGet.mockReturnValueOnce(undefined)
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedBrand } },
        { action: 'add', data: { after: clonedLogo } },
      ])

      expect(mockPut).toHaveBeenCalledTimes(5)
      expect(mockPut).toHaveBeenCalledWith({
        url: `/api/v2/brands/${brandId}`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })
      expect(mockBrandGet).toHaveBeenCalledTimes(5)

      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual(
        createSaltoElementError({
          message: `Can't deploy ${logoInstance.elemID.name} of the type brand_logo, due to Zendesk's API limitations. Please upload it manually in Zendesk Admin Center`,
          detailedMessage: `Can't deploy ${logoInstance.elemID.name} of the type brand_logo, due to Zendesk's API limitations. Please upload it manually in Zendesk Admin Center`,
          severity: 'Error',
          elemID: clonedLogo.elemID,
        }),
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(clonedBrand.value)
    })
    it('should return errors', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = logoInstance.clone()
      clonedLogo.annotations[CORE_ANNOTATIONS.PARENT] = []
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedBrand } },
        { action: 'add', data: { after: clonedLogo } },
      ])

      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual(
        createSaltoElementError({
          message: `Expected ${clonedLogo.elemID.getFullName()} to have exactly one parent, found 0`,
          detailedMessage: `Expected ${clonedLogo.elemID.getFullName()} to have exactly one parent, found 0`,
          severity: 'Error',
          elemID: clonedLogo.elemID,
        }),
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(clonedBrand.value)
    })
  })
})
