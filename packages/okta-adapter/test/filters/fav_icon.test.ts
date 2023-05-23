/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile, getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { FAVORITE_ICON_TYPE_NAME, BRAND_THEME_TYPE_NAME, BRAND_TYPE_NAME, OKTA } from '../../src/constants'
import OktaClient from '../../src/client/client'
import { getFilterParams, mockClient } from '../utils'
import favIconFilter from '../../src/filters/fav_icon'
import * as connectionModule from '../../src/client/connection'

jest.mock('../../src/client/connection', () => ({
  ...jest.requireActual('../../src/client/connection'),
  getResource: jest.fn(),
}))

const mockedConnection = jest.mocked(connectionModule, true)
describe('favorite icon filter', () => {
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  const brandThemeType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_THEME_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
  const brandLogoType = new ObjectType({ elemID: new ElemID(OKTA, FAVORITE_ICON_TYPE_NAME) })
  const fileName = 'favicon.ico'
  const content = Buffer.from('test')
  const brandInstance = new InstanceElement(
    'brand1',
    brandType,
    {
      id: '9',
      name: 'brand1',
    },
  )
  const brandThemeInstance = new InstanceElement(
    'brandTheme1',
    brandThemeType,
    {
      id: '11',
      logo: 'https://ok12static.oktacdn.com/bc/image/111',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brandInstance.elemID, brandInstance)],
    }
  )
  beforeEach(async () => {
    jest.clearAllMocks()
    const mockCli = mockClient()
    client = mockCli.client
    filter = favIconFilter(getFilterParams({ client })) as typeof filter
  })
  describe('onFetch', () => {
    beforeEach(async () => {
      mockedConnection.getResource.mockImplementation(async url => {
        if (url === 'https://ok12static.oktacdn.com/bc/image/111') {
          return {
            status: 200,
            data: content,
          } as unknown as ReturnType<typeof connectionModule.getResource>
        }
        throw new Error('Err')
      })
    })
    it('should create AppLogo type and AppLogo instance', async () => {
      const elements = [brandThemeType, brandThemeInstance].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'okta.BrandTheme',
          'okta.BrandTheme.instance.brandTheme1',
          'okta.FavoriteIcon',
          'okta.FavoriteIcon.instance.favicon',
        ])
    })
    it('check that barndLogo instance has the correct values', async () => {
      const elements = [brandThemeType, brandThemeInstance].map(e => e.clone())
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const logo = instances.find(e => e.elemID.typeName === FAVORITE_ICON_TYPE_NAME)
      expect(logo?.value).toEqual({
        id: '111',
        fileName: 'favicon.ico',
        contentType: 'ico',
        content: new StaticFile({
          filepath: 'okta/FavoriteIcon/favicon.ico', encoding: 'binary', content,
        }),
      })
    })
  })
  describe('deploy', () => {
    let brandLogoInstance: InstanceElement
    beforeEach(async () => {
      brandLogoInstance = new InstanceElement(
        'brandLogo',
        brandLogoType,
        {
          id: '111',
          fileName,
          contentType: 'png',
          content: new StaticFile({
            filepath: 'okta/BrandLogo/brandLogo.png', encoding: 'binary', content,
          }),
        },
      )
      brandLogoInstance.annotate({
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(brandThemeInstance.elemID, brandThemeInstance),
          new ReferenceExpression(brandInstance.elemID, brandInstance),
        ],
      })
      mockedConnection.getResource.mockImplementation(async url => {
        if (url === 'https://ok12static.oktacdn.com/bc/image/111') {
          return {
            status: 200,
            data: content,
          } as unknown as ReturnType<typeof connectionModule.getResource>
        }
        throw new Error('Err')
      })
    })
    it('should add logo instance to elements', async () => {
      const clonedBrandTheme = brandThemeInstance.clone()
      const clonedLogo = brandLogoInstance.clone()
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedBrandTheme } },
        { action: 'add', data: { after: clonedLogo } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value)
        .toEqual(clonedBrandTheme.value)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'add', data: { after: clonedLogo } }
      )
    })
    it('should modify logo instances', async () => {
      const beforeLogo = brandLogoInstance.clone()
      const afterLogo = brandLogoInstance.clone()
      afterLogo.value.content = new StaticFile({
        filepath: 'okta/AppLogo/changed.png',
        encoding: 'binary',
        content: Buffer.from('changes!'),
      })
      const res = await filter.deploy([
        { action: 'modify', data: { before: beforeLogo, after: afterLogo } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'modify', data: { before: beforeLogo, after: afterLogo } }
      )
    })
    it('should remove logo instances', async () => {
      const clonedLogo = brandLogoInstance.clone()
      const clonedBrandTheme = brandThemeInstance.clone()
      const res = await filter.deploy([
        { action: 'remove', data: { before: clonedBrandTheme } },
        { action: 'remove', data: { before: clonedLogo } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value)
        .toEqual(clonedBrandTheme.value)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'remove', data: { before: clonedLogo } }
      )
    })
    it('should return errors', async () => {
      const clonedBrand = brandInstance.clone()
      const clonedLogo = brandLogoInstance.clone()
      clonedLogo.annotations[CORE_ANNOTATIONS.PARENT] = []
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedBrand } },
        { action: 'add', data: { after: clonedLogo } },
      ])

      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value)
        .toEqual(clonedBrand.value)
    })
  })
})
