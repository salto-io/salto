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
import { ObjectType, ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import guideThemeDeleteLiveValidator from '../../src/change_validators/guide_theme_delete_live'
import { ZENDESK, GUIDE_THEME_TYPE_NAME } from '../../src/constants'

describe('guideThemeDeleteLiveValidator', () => {
  const guideThemeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
  const guideThemeInstance = new InstanceElement(
    'guideThemeInstance',
    guideThemeType,
    {
      name: 'guideThemeInstance',
      live: true,
    }
  )
  const guideThemeInstanceNotLive = new InstanceElement(
    'guideThemeInstanceNotLive',
    guideThemeType,
    {
      name: 'guideThemeInstanceNotLive',
      live: false,
    }
  )

  it('should return error when deleting live theme', async () => {
    const changeErrors = await guideThemeDeleteLiveValidator([
      toChange({ before: guideThemeInstance }),
    ])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].elemID).toEqual(guideThemeInstance.elemID)
    expect(changeErrors[0].message).toEqual('Cannot delete live themes')
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual('Cannot delete live themes, please unpublish the theme first')
  })

  it('should not return error when deleting non-live theme', async () => {
    const changeErrors = await guideThemeDeleteLiveValidator([
      toChange({ before: guideThemeInstanceNotLive }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
