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
import { ElemID, getChangeData, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import guideDefaultLanguage, { DEFAULT_LOCALE_API } from '../../src/filters/guide_default_language_settings'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { BRAND_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'

const createBrand = (name: string, id: number): InstanceElement => new InstanceElement(
  name, new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), { id, has_help_center: true }
)
const brand1 = createBrand('brand1', 1)
const brand2 = createBrand('brand2', 2)

const guideLanguageSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME) })
const createSettings = (name: string, locale: string, brand: InstanceElement): InstanceElement =>
  new InstanceElement(name, guideLanguageSettingsType, { locale, brand: new ReferenceExpression(brand.elemID, brand) })

const client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
client.put = jest.fn()
client.getSinglePage = jest.fn().mockResolvedValue({ data: 'def' })

describe('guideDefaultLanguage', () => {
  const config = { ...DEFAULT_CONFIG }
  config[FETCH_CONFIG].enableGuide = true
  const filter = guideDefaultLanguage(
    createFilterCreatorParams({ config, client, brandIdToClient: { 1: client, 2: client } })
  ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

  it('onFetch', async () => {
    const defaultSettings = createSettings('default', 'def', brand1)
    const defaultSettings2 = createSettings('default2', 'def', brand2)
    const notDefaultSettings = createSettings('notDefault', 'notDef', brand1)
    const notDefaultSettings2 = createSettings('notDefault2', 'notDef', brand2)

    const elements = [brand1, brand2, defaultSettings, defaultSettings2, notDefaultSettings, notDefaultSettings2]
    await filter.onFetch(elements)
    expect(defaultSettings.value.default).toBe(true)
    expect(defaultSettings2.value.default).toBe(true)
    expect(notDefaultSettings.value.default).toBe(false)
    expect(notDefaultSettings2.value.default).toBe(false)
  })
  it('deploy', async () => {
    const defaultSettings = createSettings('def', 'def', brand1)
    const notDefaultSettings = createSettings('notDef', 'notDef', brand1)
    defaultSettings.value.default = true
    notDefaultSettings.value.default = false

    const mockPut = jest.spyOn(client, 'put')
    const testDeploy = async (
      before: InstanceElement | undefined,
      after: InstanceElement | undefined,
      shouldCall: boolean
    ) : Promise<void> => {
      const change = toChange({ before, after })
      mockPut.mockReset()
      await filter.deploy([change])

      // Make sure the 'default' field was deleted
      expect(getChangeData(change).value.default).toBe(undefined)

      if (shouldCall) {
        expect(mockPut).toHaveBeenCalledTimes(1)
        expect(mockPut).toHaveBeenCalledWith({
          url: DEFAULT_LOCALE_API,
          data: { locale: 'def' },
        })
      } else {
        expect(mockPut).toHaveBeenCalledTimes(0)
      }
    }

    await testDeploy(defaultSettings.clone(), defaultSettings.clone(), false) // True -> True = no change
    await testDeploy(notDefaultSettings.clone(), defaultSettings.clone(), true) // False -> True = change
    await testDeploy(undefined, defaultSettings.clone(), true) // Only True = change
    await testDeploy(undefined, notDefaultSettings.clone(), false) // Only False = no change
    await testDeploy(defaultSettings.clone(), undefined, false) // Removal = no change
  })
})
