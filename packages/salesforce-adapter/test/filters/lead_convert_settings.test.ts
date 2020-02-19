/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, InstanceElement, Element, findInstances } from '@salto-io/adapter-api'
import filterCreator, {
  LEAD_CONVERT_SETTINGS_TYPE_ID, LEAD_TYPE_ID,
} from '../../src/filters/lead_convert_settings'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('lead convert settings filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'> & FilterWith<'onUpdate'>

  const mockLead = new ObjectType(
    { elemID: LEAD_TYPE_ID,
      path: [constants.SALESFORCE, constants.OBJECTS_PATH, LEAD_TYPE_ID.name, 'LeadFileName'] }
  )

  const mockConvertSettingsType = new ObjectType({ elemID: LEAD_CONVERT_SETTINGS_TYPE_ID })

  const mockConvertSettingsInstance = new InstanceElement(
    LEAD_CONVERT_SETTINGS_TYPE_ID.name,
    mockConvertSettingsType,
  )

  describe('on fetch', () => {
    let testElements: Element[]

    beforeEach(async () => {
      testElements = [_.clone(mockLead),
        _.clone(mockConvertSettingsType),
        _.clone(mockConvertSettingsInstance)]
      await filter.onFetch(testElements)
    })

    it('should modify the LeadConvertSettings instance path', async () => {
      const convertSettingsInstance = [...findInstances(testElements,
        LEAD_CONVERT_SETTINGS_TYPE_ID)].pop() as InstanceElement
      expect(convertSettingsInstance.path)
        .toEqual([constants.SALESFORCE, constants.OBJECTS_PATH, LEAD_TYPE_ID.name,
          LEAD_CONVERT_SETTINGS_TYPE_ID.name])
    })
  })
})
