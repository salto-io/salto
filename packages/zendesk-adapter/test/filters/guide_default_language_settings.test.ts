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
import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import guideDefaultLanguage, { DEFAULT_LOCALE_API } from '../../src/filters/guide_default_language_settings'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import {
  BRAND_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'

const createBrand = (name: string, id: number): InstanceElement => new InstanceElement(
  name, new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), { id, has_help_center: true }
)
const brand1 = createBrand('brand1', 1)
const brand2 = createBrand('brand2', 2)

const guideSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_SETTINGS_TYPE_NAME) })
const settings1 = new InstanceElement('settings1', guideSettingsType, { brand: 1 })
const settings2 = new InstanceElement('settings2', guideSettingsType, { brand: 2 })

const guideLanguageSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME) })
const createSettings = (name: string, locale: string, brand: InstanceElement): InstanceElement =>
  new InstanceElement(name, guideLanguageSettingsType, { locale, brand: brand.value.id })

const defaultSettings1 = createSettings('default', 'def', brand1)
const defaultSettings2 = createSettings('default2', 'def', brand2)

const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
client.put = jest.fn()
client.getSinglePage = jest.fn().mockResolvedValue({ data: 'def' })

describe('guideDefaultLanguage', () => {
  const config = { ...DEFAULT_CONFIG }
  config[FETCH_CONFIG].guide = { brands: ['.*'] }
  const filter = guideDefaultLanguage(
    createFilterCreatorParams({ config, client, brandIdToClient: { 1: client, 2: client } })
  ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

  it('onFetch', async () => {
    const notDefaultSettings1 = createSettings('notDefault', 'notDef', brand1)
    const notDefaultSettings2 = createSettings('notDefault2', 'notDef', brand2)

    const elements = [
      brand1, brand2,
      settings1, settings2,
      defaultSettings1, defaultSettings2,
      notDefaultSettings1, notDefaultSettings2,
    ]
    await filter.onFetch(elements)
    expect(settings1.value.default_locale)
      .toMatchObject(new ReferenceExpression(defaultSettings1.elemID, defaultSettings1))
    expect(settings2.value.default_locale)
      .toMatchObject(new ReferenceExpression(defaultSettings2.elemID, defaultSettings2))
  })
  it('deploy', async () => {
    const beforeSettings = settings1.clone()
    const afterSettings = settings1.clone()
    beforeSettings.value.default_locale = 'before'
    afterSettings.value.default_locale = 'after'

    const mockPut = jest.spyOn(client, 'put')
    await filter.deploy([
      toChange({ before: beforeSettings }), // Removal change - should do nothing
      toChange({ after: afterSettings }), // Addition change - Should do nothing
      toChange({ before: beforeSettings, after: beforeSettings }), // No change - should do nothing
      toChange({ before: beforeSettings, after: afterSettings }), // change - should send api request
    ])

    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith({
      url: DEFAULT_LOCALE_API,
      data: { locale: 'after' },
    })
  })
})
