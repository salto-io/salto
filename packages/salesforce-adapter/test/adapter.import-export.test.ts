import {
  ObjectType, ElemID, InstanceElement,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/jsforce'
import mockAdpater from './adapter'
import * as constants from '../src/constants'

describe('SalesforceAdapter import-export operations', () => {
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
    const testType = new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, 'test'),
      fields: {},
      annotationTypes: {},
      annotations: {
        [constants.API_NAME]: 'Test__c',
      },
    })

    const firstRecords = [{
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
    }]

    const secondRecords = [{
      attributes: {
        type: 'Test',
      },
      FirstName: 'Johnny',
      LastName: 'Walker',
    }, {
      attributes: {
        type: 'Test',
      },
      FirstName: 'Lady',
      LastName: 'Gaga',
    }]

    describe('When there is no next record URL', () => {
      beforeEach(() => {
        connection.query = jest.fn()
          .mockImplementation(async () => (
            {
              totalSize: 2,
              done: true,
              records: firstRecords,
            }))
      })
      it('should not call queryMore ', async () => {
        const iterator = adapter.getInstancesOfType(testType)
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
    })

    describe('When there is a next record URL', () => {
      beforeEach(() => {
        connection.query = jest.fn()
          .mockImplementation(async () => (
            {
              totalSize: 2,
              done: false,
              nextRecordsUrl: 'www.salto.io',
              records: firstRecords,
            }))
        connection.queryMore = jest.fn()
          .mockImplementation(async () => (
            {
              totalSize: 2,
              done: true,
              records: secondRecords,
            }))
      })
      it('should return more than one page', async () => {
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

  describe('Import instances of type', () => {
    let mockLoad: jest.Mock<unknown>
    let mockThen: jest.Mock<unknown>
    let mockRetrieve: jest.Mock<unknown>

    beforeEach(() => {
      mockThen = jest.fn(() => Promise.resolve())
      mockRetrieve = jest.fn(() => Promise.resolve())
      mockLoad = jest.fn(() => ({ then: mockThen, retrieve: mockRetrieve }))
      connection.bulk.load = mockLoad
    })

    const testObjectType = 'Test__c'

    const testType = new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, 'test'),
      fields: {},
      annotationTypes: {},
      annotations: {
        [constants.API_NAME]: testObjectType,
      },
    })

    const mockSingleInstanceIterator = async function *mockSingleInstanceIterator(): AsyncIterable<
    InstanceElement> {
      const elemID = new ElemID('salesforce')
      const values = [
        {
          Id: 1,
          FirstName: 'Daile',
          LastName: 'Limeburn',
          Email: 'dlimeburn0@blogs.com',
          Gender: 'Female',
        }, {
          Id: 2,
          FirstName: 'Murial',
          LastName: 'Morson',
          Email: 'mmorson1@google.nl',
          Gender: 'Female',
        }, {
          Id: 3,
          FirstName: 'Minna',
          LastName: 'Noe',
          Email: 'mnoe2@wikimedia.org',
          Gender: 'Female',
        },
      ]

      const elements = values.map(value => new InstanceElement(
        elemID,
        testType,
        value
      ))

      // eslint-disable-next-line no-restricted-syntax
      for (const element of elements) {
        yield element
      }
    }

    it('should call the bulk API with the correct object type name', async () => {
      await adapter.importInstancesOfType(testType, mockSingleInstanceIterator())
      expect(mockLoad.mock.calls[0][0]).toEqual(testObjectType)
    })
  })
})
