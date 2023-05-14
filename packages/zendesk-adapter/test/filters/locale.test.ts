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
import { filterUtils } from '@salto-io/adapter-components'
import {
  ElemID,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/locale'
import { LOCALE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { FilterResult } from '../../src/filter'

describe('locale filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch', FilterResult>
  let filter: FilterType

  const localeType = new ObjectType({ elemID: new ElemID(ZENDESK, LOCALE_TYPE_NAME) })
  const warningMsg = 'Please be aware that your Zendesk account\'s default locale is not set to English (en-US), which may impact your ability to compare environments with different default locales'

  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should add warning when default locale is not english', async () => {
      const enUsLocaleInstance = new InstanceElement(
        'en US',
        localeType,
        {
          locale: 'en-US',
          default: false,
        }
      )
      const heLocaleInstance = new InstanceElement(
        'he',
        localeType,
        {
          locale: 'he',
          default: true,
        }
      )

      const res = await filter.onFetch([enUsLocaleInstance, heLocaleInstance]) as FilterResult
      expect(res.errors).toEqual([
        {
          message: warningMsg,
          severity: 'Warning',
        },
      ])
    })
    it('should not add warning when default locale is english', async () => {
      const enUsLocaleInstance = new InstanceElement(
        'en US',
        localeType,
        {
          locale: 'en-US',
          default: true,
        }
      )
      const heLocaleInstance = new InstanceElement(
        'he',
        localeType,
        {
          locale: 'he',
          default: false,
        }
      )

      const res = await filter.onFetch([enUsLocaleInstance, heLocaleInstance]) as FilterResult
      expect(res.errors).toEqual([])
    })
  })
})
