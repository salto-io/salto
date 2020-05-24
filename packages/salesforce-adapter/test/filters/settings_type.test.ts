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
import {
  ElemID, InstanceElement, isInstanceElement, isObjectType, ObjectType,
} from '@salto-io/adapter-api'
import filterCreator, { } from '../../src/filters/settings_type'
import mockClient from '../client'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'
import SalesforceClient from '../../src/client/client'


describe('Test Settings Type', () => {
  const { client } = mockClient()

  const filter = filterCreator({ client }) as FilterWith<'onFetch'>

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
      elemID: new ElemID(constants.SALESFORCE, 'ass'),
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
    let mockDescribeMetadata: jest.Mock
    let mockListMetadataObjects: jest.Mock
    let mockReadMetadata: jest.Mock

    beforeEach(() => {
      mockListMetadataObjects = jest.fn()
        .mockImplementationOnce(async () => ({ result: [{ fullName: 'Macro' }] }))

      mockDescribeMetadata = jest.fn().mockImplementationOnce(async () => [
        {
          isForeignKey: false,
          isNameField: true,
          minOccurs: 0,
          name: 'fullName',
          soapType: 'string',
          valueRequired: true,
          fields: [],
          picklistValues: [],
        },
        {
          isForeignKey: false,
          isNameField: false,
          minOccurs: 0,
          name: 'enableAdvancedSearch',
          soapType: 'boolean',
          valueRequired: true,
          fields: [],
          picklistValues: [],
        },
        {
          isForeignKey: false,
          isNameField: false,
          minOccurs: 0,
          name: 'macrosInFolders',
          soapType: 'boolean',
          valueRequired: true,
          fields: [],
          picklistValues: [],
        },
      ])

      mockReadMetadata = jest.fn()
        .mockImplementationOnce(() => ({ result: [
          { fullName: 'Macro', enableAdvancedSearch: false, macrosInFolders: false },
        ] }))

      SalesforceClient.prototype.listMetadataObjects = mockListMetadataObjects
      SalesforceClient.prototype.describeMetadataType = mockDescribeMetadata
      SalesforceClient.prototype.readMetadata = mockReadMetadata
    })

    it('should generate all settings type', async () => {
      await filter.onFetch(testElements)
      expect(mockDescribeMetadata.mock.calls).toHaveLength(1)
      expect(mockDescribeMetadata.mock.calls[0]).toHaveLength(1)
      expect(mockDescribeMetadata.mock.calls[0][0]).toEqual('MacroSettings')
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
      expect((testElements[4] as InstanceElement).type).toEqual(testElements[3])
    })
  })
})
