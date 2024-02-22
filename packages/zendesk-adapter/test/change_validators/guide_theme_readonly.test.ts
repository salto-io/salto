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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { guideThemeReadonlyValidator } from '../../src/change_validators/guide_theme_readonly'
import { GUIDE_THEME_TYPE_NAME, ZENDESK } from '../../src/constants'

describe('guideThemeReadonlyValidator', () => {
  const guideThemeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
  const guideThemeInstance = new InstanceElement('guideThemeInstance', guideThemeType, {
    name: 'guideThemeInstance',
    live: true,
  })
  const message = 'Guide Themes deploy support is currently under development, and is currently in read only mode.'
  it('should return a warning on modification theme changes', async () => {
    const changeErrors = await guideThemeReadonlyValidator([
      toChange({ before: guideThemeInstance, after: guideThemeInstance }),
    ])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual(
      'Deploying Guide Themes is not supported at the moment as Guide Themes is currently under development.',
    )
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual(message)
  })
  it('should return a warning on addition theme changes', async () => {
    const changeErrors = await guideThemeReadonlyValidator([toChange({ after: guideThemeInstance })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual(
      'Deploying Guide Themes is not supported at the moment as Guide Themes is currently under development.',
    )
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual(message)
  })
  it('should return a warning on deletion theme changes', async () => {
    const changeErrors = await guideThemeReadonlyValidator([toChange({ before: guideThemeInstance })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual(
      'Deploying Guide Themes is not supported at the moment as Guide Themes is currently under development.',
    )
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual(message)
  })
})
