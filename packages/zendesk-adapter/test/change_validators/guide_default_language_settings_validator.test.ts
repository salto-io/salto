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
import { ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { defaultLanguageSettingsValidator } from '../../src/change_validators'
import { BRAND_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'

const guideLanguageSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME) })
const brand = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }))
const defaultSettings = new InstanceElement(
  'default',
  guideLanguageSettingsType,
  { default: true, brand }
)
const notDefaultSettings = new InstanceElement(
  'notDefault',
  guideLanguageSettingsType,
  { default: false, brand }
)

describe('defaultLanguageSettingsValidator', () => {
  it('No remove and no add', async () => {
    const result = await defaultLanguageSettingsValidator([])
    expect(result).toMatchObject([])
  })
  it('One remove and one add', async () => {
    // This test also tests handling addition and removal changes
    const addChange = toChange({ after: defaultSettings })
    const removeChange = toChange({ before: defaultSettings })
    const result = await defaultLanguageSettingsValidator([addChange, removeChange])
    expect(result).toMatchObject([])
  })
  it('No remove and one add', async () => {
    const addChange = toChange({ before: notDefaultSettings, after: defaultSettings })
    const result = await defaultLanguageSettingsValidator([addChange])
    expect(result).toMatchObject([{
      elemID: defaultSettings.elemID,
      severity: 'Error',
      message: 'Invalid amount of default languages of a brand, there must be exactly one default language',
      detailedMessage: `A default language (${defaultSettings.elemID.name}) was added for brand '${brand.elemID.name}', but no default language was removed.`,
    }])
  })
  it('One remove and no add', async () => {
    const removeChange = toChange({ before: defaultSettings, after: notDefaultSettings })
    const result = await defaultLanguageSettingsValidator([removeChange])
    expect(result).toMatchObject([{
      elemID: notDefaultSettings.elemID,
      severity: 'Error',
      message: 'Invalid amount of default languages of a brand, there must be exactly one default language',
      detailedMessage: `A default language (${notDefaultSettings.elemID.name}) was removed from brand '${brand.elemID.name}', but no default language was added.`,
    }])
  })
  it('more than one add', async () => {
    const addChange = toChange({ before: notDefaultSettings, after: defaultSettings })
    const changes = [addChange, addChange, addChange]
    const result = await defaultLanguageSettingsValidator(changes)
    const error = {
      elemID: defaultSettings.elemID,
      severity: 'Error',
      message: 'Invalid amount of default languages of a brand, there must be exactly one default language',
      detailedMessage: `Too many default languages were added for brand '${brand.elemID.name}'. (${changes.map(getChangeData).map(change => change.elemID.name)})`,
    }
    expect(result).toMatchObject([error, error, error])
  })
})
