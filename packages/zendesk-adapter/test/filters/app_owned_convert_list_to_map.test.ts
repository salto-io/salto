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
import _ from 'lodash'
import { ObjectType, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import { APP_OWNED_TYPE_NAME, ZENDESK } from '../../src/constants'

import filterCreator, { AppOwnedParameter } from '../../src/filters/app_owned_convert_list_to_map'

describe('appOwnedConvertListToMap filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const appOwnedType = new ObjectType({ elemID: new ElemID(ZENDESK, APP_OWNED_TYPE_NAME) })
  const appOwnedParameter: AppOwnedParameter = {
    name: 'name',
  }
  const appOwnedOtherParameter: AppOwnedParameter = {
    name: 'name2',
  }
  const appOwnedInstance = new InstanceElement('app_owned_test_name', appOwnedType, {
    owner_id: 12192413,
    name: 'xr_app',
    single_install: false,
    default_locale: 'en',
    author_name: 'John Doe',
    author_email: 'jdoe@example.com',
    short_description: 'short_description_test',
    long_description: 'long_description_test',
    raw_long_description: 'raw_long_description_test',
    installation_instructions: 'installation_instrunctions_test',
    raw_installation_instructions: 'Simply click install.',
    small_icon: 'https://example.com/icon.png',
    large_icon: 'https://example.com/large_icon.png',
    visibility: 'private',
    installable: true,
    framework_version: '2.0',
    featured: false,
    promoted: false,
    products: ['support'],
    version: '1.0',
    marketing_only: false,
    deprecated: false,
    obsolete: false,
    paid: false,
    state: 'published',
    closed_preview: false,
    parameters: [appOwnedParameter, appOwnedOtherParameter],
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should add the correct type and instances and convert parameters field to map', async () => {
      const elements = [appOwnedType.clone(), appOwnedInstance.clone()]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.app_owned',
        'zendesk.app_owned.instance.app_owned_test_name',
      ])
      const appOwnedInstanceElements = elements.filter(isInstanceElement)
      expect(appOwnedInstanceElements).toHaveLength(1)

      const appOwnedInstanceElement = appOwnedInstanceElements[0]
      expect(appOwnedInstanceElement).toBeDefined()

      const appOwnedInstanceElementParameters = appOwnedInstanceElement.value.parameters
      expect(appOwnedInstanceElementParameters).toBeDefined()
      expect(Object.keys(appOwnedInstanceElementParameters)).toHaveLength(2)

      const elementParameter: AppOwnedParameter = appOwnedInstanceElementParameters[appOwnedParameter.name]
      expect(elementParameter).toBeDefined()

      const elementOtherParameter: AppOwnedParameter = appOwnedInstanceElementParameters[appOwnedOtherParameter.name]
      expect(elementOtherParameter).toBeDefined()

      expect(_.keys(elementParameter)).toMatchObject(
        _.omitBy(_.keys(appOwnedParameter), ['id', 'app_id', 'created_at', 'updated_at']),
      )

      expect(_.keys(elementOtherParameter)).toMatchObject(
        _.omitBy(_.keys(appOwnedOtherParameter), ['id', 'app_id', 'created_at', 'updated_at']),
      )
    })
  })
})
