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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { ZENDESK, BRAND_TYPE_NAME } from '../../src/constants'
import { getBrandsForGuide } from '../../src/filters/utils'

describe('Zendesk utils', () => {
  describe('getBrandsForGuide', () => {
    const brandType = new ObjectType({
      elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    })
    const brandInstances = [
      new InstanceElement(
        'guideTest',
        brandType,
        {
          name: 'guideTest',
          has_help_center: true,
        },
      ),
      new InstanceElement(
        'TestforGuide',
        brandType,
        {
          name: 'TestforGuide',
          has_help_center: true,
        },
      ),
      new InstanceElement(
        'BrandBrand',
        brandType,
        {
          name: 'BrandBrand',
          has_help_center: true,
        },
      ),
      new InstanceElement(
        'TestforGuide',
        brandType,
        {
          name: 'NoHelpCenterBrand',
          has_help_center: false,
        },
      ),
    ]

    it('should return all brands with help center', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['.*'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res.map(r => r.elemID.name).sort()).toEqual(['BrandBrand', 'TestforGuide', 'guideTest'])
    })
    it('it should exclude all brands that contain the word Test', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['^((?!Test).)*$'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res.map(r => r.elemID.name)).toEqual(['BrandBrand'])
    })
    it('should return an empty list of brands', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['NoBrand', 'SomeBrand'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res).toEqual([])
    })
  })
})
