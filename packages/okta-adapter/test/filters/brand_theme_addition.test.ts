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

import { MockInterface } from '@salto-io/test-utils'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import brandThemeAdditionFilter from '../../src/filters/brand_theme_addition'
import { OKTA, BRAND_THEME_TYPE_NAME } from '../../src/constants'

describe('brandThemeAdditionFilter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const themeType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_THEME_TYPE_NAME) })
  const themeInstance = new InstanceElement(
    'theme',
    themeType,
    {
      secondaryColorHex: '#abcdef',
    },
    undefined,
    { _parent: [{ id: 'brandId123' }] },
  )

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = brandThemeAdditionFilter(getFilterParams({ client })) as typeof filter
  })

  describe('deploy', () => {
    it('should successfully deploy addition changes of brand theme', async () => {
      mockConnection.get.mockResolvedValue({
        status: 200,
        data: [
          {
            id: 'themeId456',
          },
        ],
      })
      mockConnection.put.mockResolvedValue({ status: 200, data: {} })
      const result = await filter.deploy([toChange({ after: themeInstance })])
      expect(result.deployResult.appliedChanges).toHaveLength(1)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/brands/brandId123/themes', undefined)
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/api/v1/brands/brandId123/themes/themeId456',
        {
          secondaryColorHex: '#abcdef',
        },
        undefined,
      )
    })
    it('should throw an error when failing to get the theme id - no themes returned', async () => {
      mockConnection.get.mockResolvedValue({
        status: 200,
        data: [{ id: 'themeId456' }, { id: 'themeId789' }],
      })
      const result = await filter.deploy([toChange({ after: themeInstance })])
      expect(result.deployResult.errors).toEqual([
        {
          elemID: themeInstance.elemID,
          message: 'Could not find BrandTheme with the provided brandId',
          severity: 'Error',
        },
      ])
    })
    it('should throw an error when failing to get the theme id - multiple themes returned', async () => {
      mockConnection.get.mockResolvedValue({ status: 200, data: [] })
      const result = await filter.deploy([toChange({ after: themeInstance })])
      expect(result.deployResult.errors).toEqual([
        {
          elemID: themeInstance.elemID,
          message: 'Could not find BrandTheme with the provided brandId',
          severity: 'Error',
        },
      ])
    })
    it('should throw an error when the parent brand is already resolved', async () => {
      const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_THEME_TYPE_NAME) })
      const brandInstance = new InstanceElement('brand', brandType, { id: 'brandId123' })
      themeInstance.annotations[CORE_ANNOTATIONS.PARENT][0] = new ReferenceExpression(
        brandInstance.elemID,
        brandInstance,
      )
      const result = await filter.deploy([toChange({ after: themeInstance })])
      expect(result.deployResult.errors).toEqual([
        {
          elemID: themeInstance.elemID,
          message: 'BrandTheme must have valid brandId',
          severity: 'Error',
        },
      ])
    })
  })
})
