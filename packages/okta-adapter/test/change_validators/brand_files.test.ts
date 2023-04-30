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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { brandThemeFilesValidator } from '../../src/change_validators/brand_files'
import { OKTA } from '../../src/constants'

describe('brandThemeFilesValidator', () => {
  const brandTheme = new ObjectType({ elemID: new ElemID(OKTA, 'BrandTheme') })
  const themeInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    brandTheme,
    { logo: 'https://okta.okta.com', favicon: 'https://www.preview.com/123123123', primaryColorHex: '#ffffff' },
  )

  it('should return info when modifying brand theme app', async () => {
    const errors = await brandThemeFilesValidator([
      toChange({ before: themeInstance, after: themeInstance }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors).toEqual([
      {
        elemID: themeInstance.elemID,
        severity: 'Info',
        message: 'Changes to brand logo and brand favicon are not supported',
        detailedMessage: 'Changes to brand logo and brand favicon will not be deployed, please use the admin console',
      },
    ])
  })
})
