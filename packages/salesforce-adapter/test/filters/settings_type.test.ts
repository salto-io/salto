import {
  ElemID, InstanceElement, isInstanceElement, isObjectType, ObjectType,
} from 'adapter-api'
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
    fields: {
    },
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
        .mockImplementationOnce(async () => [{ fullName: 'Macro' }])

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
        .mockImplementationOnce(() => [
          { fullName: 'Macro', enableAdvancedSearch: false, macrosInFolders: false },
        ])

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
      expect(path).toHaveLength(2)
      if (path !== undefined) {
        expect(path[0]).toEqual('types')
        expect(path[1]).toEqual('macro_settings')
      }
      expect(isInstanceElement(testElements[4])).toBeTruthy()
      expect((testElements[4] as InstanceElement).type).toEqual(testElements[3])
    })
  })
})
