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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { guideThemeUpdateMetadataValidator } from '../../src/change_validators/guide_theme_update_metadata'
import { GUIDE_THEME_TYPE_NAME, ZENDESK } from '../../src/constants'

describe('guideThemeUpdateMetadataValidator', () => {
  const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
  const brandInstance = new InstanceElement('brandInstance', brandType, {})
  const guideThemeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
  const guideThemeInstance = new InstanceElement('guideThemeInstance', guideThemeType, {
    name: 'guideThemeInstance',
    live: true,
    brand_id: new ReferenceExpression(brandInstance.elemID, brandInstance),
  })
  it('returns an error when updating theme metadata', async () => {
    const after = guideThemeInstance.clone()
    after.value.name = 'newName'
    const changeErrors = await guideThemeUpdateMetadataValidator([toChange({ before: guideThemeInstance, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual('Updating theme fields has no effect')
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].detailedMessage).toEqual(
      'Updating the theme fields name has no effect. To update them, please edit the manifest.json file',
    )
  })

  it('returns an error when updating theme brand both are references', async () => {
    const brandInstance2 = new InstanceElement('brandInstance2', brandType, {})
    const after = guideThemeInstance.clone()
    after.value.brand_id = new ReferenceExpression(brandInstance2.elemID, brandInstance2)
    const changeErrors = await guideThemeUpdateMetadataValidator([
      toChange({ before: guideThemeInstance.clone(), after }),
    ])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual('Moving a theme to a different brand is not supported')
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual('Moving a theme to a different brand is not supported')
  })
  it('should not return an error when updating theme brand both are references', async () => {
    const changeErrors = await guideThemeUpdateMetadataValidator([
      toChange({ before: guideThemeInstance, after: guideThemeInstance }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
  it('returns an error when updating theme brand both are numbers', async () => {
    const before = guideThemeInstance.clone()
    const after = guideThemeInstance.clone()
    before.value.brand_id = 1
    after.value.brand_id = 2
    const changeErrors = await guideThemeUpdateMetadataValidator([toChange({ before, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual('Moving a theme to a different brand is not supported')
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual('Moving a theme to a different brand is not supported')
  })
  it('should not return an error when updating theme brand both are numbers', async () => {
    const before = guideThemeInstance.clone()
    before.value.brand_id = 1
    const changeErrors = await guideThemeUpdateMetadataValidator([toChange({ before, after: before })])
    expect(changeErrors).toHaveLength(0)
  })
  it('returns an error when updating theme brand and are both not the same type', async () => {
    const after = guideThemeInstance.clone()
    delete after.value.brand_id
    const changeErrors = await guideThemeUpdateMetadataValidator([
      toChange({ before: guideThemeInstance.clone(), after }),
    ])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual('Moving a theme to a different brand is not supported')
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual('Moving a theme to a different brand is not supported')
  })
})
