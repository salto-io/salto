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
import {
  ElemID, InstanceElement, isInstanceElement, isObjectType, ObjectType,
} from '@salto-io/adapter-api'
import filterCreator, { } from '../../src/filters/settings_type'
import mockClient from '../client'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { mockFileProperties, mockDescribeValueResult, mockValueTypeField } from '../connection'
import { defaultFilterContext } from '../utils'


describe('Test Settings Type', () => {
  const { client, connection } = mockClient()

  const filter = filterCreator(
    {
      client,
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({
          metadata: {
            exclude: [
              { metadataType: 'CaseSettings' },
            ],
          },
        }),
      },
    }
  ) as FilterWith<'onFetch'>

  const mockElemID = new ElemID(constants.SALESFORCE, 'settingsTest')

  const mockObject = new ObjectType({
    elemID: mockElemID,
    annotations: {
      label: 'test label',
      [constants.API_NAME]: 'Test__c',
    },
    isSettings: false,
  })

  const mockInstance = new InstanceElement(
    'lead',
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, 'inst'),
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead',
    },
  )

  const anotherMockInstance = new InstanceElement(
    'lead',
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, 'testInst'),
      isSettings: false,
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead',
    },
  )

  const testElements = [mockInstance, mockObject, anotherMockInstance]

  describe('on discover', () => {
    beforeEach(() => {
      connection.metadata.list.mockResolvedValue(
        ['Macro', 'Case'].map(fullName => mockFileProperties({ fullName, type: 'Settings' }))
      )
      connection.metadata.describeValueType.mockResolvedValue(
        mockDescribeValueResult({
          valueTypeFields: [
            { name: 'fullName', soapType: 'string' },
            { name: 'enableAdvancedSearch', soapType: 'boolean' },
            { name: 'macrosInFolders', soapType: 'boolean' },
          ].map(mockValueTypeField),
        })
      )

      const settingsInstValue = {
        fullName: 'Macro',
        enableAdvancedSearch: false,
        macrosInFolders: false,
      }
      connection.metadata.read.mockResolvedValue(settingsInstValue)
    })

    it('should generate all settings type', async () => {
      await filter.onFetch(testElements)
      expect(connection.metadata.describeValueType).toHaveBeenCalledWith(
        expect.stringMatching(/.*MacroSettings$/)
      )
      expect(testElements).toHaveLength(5)
      expect(isObjectType(testElements[3])).toBeTruthy()
      const { path } = testElements[3]
      expect(path).toBeDefined()
      expect(path).toHaveLength(3)
      if (path !== undefined) {
        expect(path[0]).toEqual(constants.SALESFORCE)
        expect(path[1]).toEqual(constants.TYPES_PATH)
        expect(path[2]).toEqual('MacroSettings')
      }
      expect(isInstanceElement(testElements[4])).toBeTruthy()
      expect(await (testElements[4] as InstanceElement).getType()).toEqual(testElements[3])
    })
  })
})
