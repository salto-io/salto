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
import {
  ElemID,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/guide_fetch_section_and_category'
import { ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'

describe('guid section filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const sectionTypeName = 'section'
  const sectionTranslationTypename = 'section_translation'
  const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })
  const sectionTranslationType = new ObjectType(
    { elemID: new ElemID(ZENDESK, sectionTranslationTypename) }
  )


  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should omit the name and description fields', async () => {
      const sectionTranslationInstance = new InstanceElement(
        'instance',
        sectionTranslationType,
        {
          locale: 'he',
          title: 'name',
          body: 'description',
        }
      )

      const sectionInstance = new InstanceElement(
        'instance',
        sectionType,
        {
          name: 'name',
          description: 'description',
          source_locale: 'he',
          translations: [
            sectionTranslationInstance.value,
          ],
        }
      )
      const sectionInstanceCopy = sectionInstance.clone()
      await filter.onFetch([sectionTranslationInstance, sectionInstanceCopy])
      expect(sectionInstanceCopy.value).toEqual({
        source_locale: 'he',
        translations: [
          sectionTranslationInstance.value,
        ],
      })
    })
  })
})
