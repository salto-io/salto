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
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { brandThemeRemovalValidator } from '../../src/change_validators/brand_theme_removal'
import { OKTA, BRAND_THEME_TYPE_NAME, BRAND_TYPE_NAME } from '../../src/constants'

describe('brandThemeRemovalValidator', () => {
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
  const brandThemeType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_THEME_TYPE_NAME) })

  const brand = new InstanceElement('brand', brandType, { id: 'brandId123' })
  const brandTheme = new InstanceElement('user type', brandThemeType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand.elemID, brand)],
  })

  it('should return an error when BrandTheme is deleted without its Brand', async () => {
    const changeErrors = await brandThemeRemovalValidator([toChange({ before: brandTheme })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: brandTheme.elemID,
        severity: 'Error',
        message: 'Cannot remove brand theme if its brand is not also being removed',
        detailedMessage: 'In order to remove this brand theme, remove its brand as well',
      },
    ])
  })
  it('should not return an error when BrandTheme is deleted with its brand', async () => {
    const changeErrors = await brandThemeRemovalValidator([
      toChange({ before: brand }),
      toChange({ before: brandTheme }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
