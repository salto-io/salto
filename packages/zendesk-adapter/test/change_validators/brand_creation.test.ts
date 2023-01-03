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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { BRAND_TYPE_NAME, ZENDESK } from '../../src/constants'
import { brandCreationValidator } from '../../src/change_validators/brand_creation'
import ZendeskClient from '../../src/client/client'

describe('brandCreationValidator', () => {
  const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
  const changeValidator = brandCreationValidator(client)
  let mockGet: jest.SpyInstance

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const brandInstance = new InstanceElement(
    'New Test',
    brandType,
    { name: 'test', subdomain: 'subdomain_test' },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  it('should return a warning if a new brand is created', async () => {
    mockGet = jest.spyOn(client, 'getSinglePage')
    mockGet.mockImplementation(params => {
      if (params.url === `/api/v2/accounts/available.json?subdomain=${brandInstance.value.subdomain}`) {
        return {
          status: 200,
          data: { success: false },
        }
      }
      throw new Error('Err')
    })
    const errors = await changeValidator(
      [toChange({ after: brandInstance })],
    )
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith({
      url: `/api/v2/accounts/available.json?subdomain=${brandInstance.value.subdomain}`,
    })
    expect(errors).toEqual([{
      elemID: brandInstance.elemID,
      severity: 'Error',
      message: 'Brand subdomain is already taken',
      detailedMessage: `Brand subdomains are globally unique, please make sure to set an available subdomain for brand ${brandInstance.value.name} before attempting to create it from Salto`,
    }])
  })
  it('should not return an error if the brand was modified', async () => {
    const clonedBeforeBrand = brandInstance.clone()
    const clonedAfterBrand = brandInstance.clone()
    clonedAfterBrand.value.subdomain = 'edited'
    mockGet = jest.spyOn(client, 'getSinglePage')
    const errors = await changeValidator(
      [toChange({ before: clonedBeforeBrand, after: clonedAfterBrand })],
    )
    expect(mockGet).toHaveBeenCalledTimes(0)
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the brand was removed', async () => {
    mockGet = jest.spyOn(client, 'getSinglePage')
    const errors = await changeValidator(
      [toChange({ before: brandInstance })],
    )
    expect(mockGet).toHaveBeenCalledTimes(0)
    expect(errors).toHaveLength(0)
  })
  it('should not return a warning if a new brand is created and subdomain is valid', async () => {
    mockGet = jest.spyOn(client, 'getSinglePage')
    mockGet.mockImplementation(params => {
      if (params.url === `/api/v2/accounts/available.json?subdomain=${brandInstance.value.subdomain}`) {
        return {
          status: 200,
          data: { success: true },
        }
      }
      throw new Error('Err')
    })
    const errors = await changeValidator(
      [toChange({ after: brandInstance })],
    )
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith({
      url: `/api/v2/accounts/available.json?subdomain=${brandInstance.value.subdomain}`,
    })
    expect(errors).toEqual([])
  })
})
