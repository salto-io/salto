import {
  ObjectType, ElemID, InstanceElement,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/connection'
import mockAdpater from './adapter'
import * as constants from '../src/constants'

describe('SalesforceAdapter discover', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  beforeEach(() => {
    ({ connection, adapter } = mockAdpater({
      adapterParams: {
        metadataAdditionalTypes: [],
      },
    }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Pagination over type instances retrieval', () => {
    it('should not call queryMore if there is no next page', async () => {
      connection.query = jest.fn()
        .mockImplementation(async () => (
          {
            totalSize: 2,
            done: true,
            records: [{
              attributes: {
                type: 'Test',
              },
              FirstName: 'Adon',
              LastName: 'Shoko',
            }, {
              attributes: {
                type: 'Test',
              },
              FirstName: 'Ringo',
              LastName: 'Star',
            }],
          }))
      const testType = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test'),
        fields: {},
        annotations: {},
        annotationsValues: {
          [constants.API_NAME]: 'Test__c',
        },
      })
      const iterator = await adapter.getInstancesOfType(testType)
      const results: InstanceElement[] = []

      // Verify we received the right number of instances
      // eslint-disable-next-line no-restricted-syntax
      for await (const objects of iterator) {
        results.push(...objects)
      }
      expect(results).toHaveLength(2)

      // Verify the query more was not called
      const queryMoreMock = connection.queryMore as jest.Mock<unknown>
      expect(queryMoreMock).not.toHaveBeenCalled()
    })

    it('should return more than one page if there is a next record URL', async () => {
      connection.query = jest.fn()
        .mockImplementation(async () => (
          {
            totalSize: 2,
            done: false,
            nextRecordsUrl: 'www.salto.io',
            records: [{
              attributes: {
                type: 'Test2',
              },
              FirstName: 'Adon',
              LastName: 'Shoko',
            }, {
              attributes: {
                type: 'Test2',
              },
              FirstName: 'Ringo',
              LastName: 'Star',
            }],
          }))
      connection.queryMore = jest.fn()
        .mockImplementation(async () => (
          {
            totalSize: 2,
            done: true,
            records: [{
              attributes: {
                type: 'Test2',
              },
              FirstName: 'Johnny',
              LastName: 'Walker',
            }, {
              attributes: {
                type: 'Test2',
              },
              FirstName: 'Lady',
              LastName: 'Gaga',
            }],
          }))
      const testType = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, 'test'),
        fields: {},
        annotations: {},
        annotationsValues: {
          [constants.API_NAME]: 'Test2__c',
        },
      })
      const iterator = adapter.getInstancesOfType(testType)
      const results: InstanceElement[] = []

      // Verify we received the right number of instances
      // eslint-disable-next-line no-restricted-syntax
      for await (const objects of iterator) {
        results.push(...objects)
      }
      expect(results).toHaveLength(4)

      // Verify the query more was not called
      const queryMoreMock = connection.queryMore as jest.Mock<unknown>
      expect(queryMoreMock).toHaveBeenCalled()
    })
  })
})
