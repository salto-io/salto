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
  ObjectType, ElemID, InstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import wu from 'wu'
import SalesforceAdapter from '../src/adapter'
import Connection from '../src/client/jsforce'
import * as constants from '../src/constants'
import mockAdapter from './adapter'

describe('SalesforceAdapter import-export operations', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
      },
    }))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Export (read) operations', () => {
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
  })

  describe('Update (create/modify/delete) operations', () => {
    let mockLoad: jest.Mock
    let mockThen: jest.Mock
    let mockRetrieve: jest.Mock

    beforeEach(() => {
      mockThen = jest.fn(() => Promise.resolve())
      mockRetrieve = jest.fn(() => Promise.resolve([
        {
          id: '1',
          success: true,
          errors: [],
        },
        {
          id: '2',
          success: true,
          errors: [],
        },
        {
          id: '3',
          success: true,
          errors: [],
        },
      ]))
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
      const values = [
        {
          Id: '1',
          FirstName: 'Daile',
          LastName: 'Limeburn',
          Email: 'dlimeburn0@blogs.com',
          Gender: 'Female',
        }, {
          Id: '2',
          FirstName: 'Murial',
          LastName: 'Morson',
          Email: 'mmorson1@google.nl',
          Gender: 'Female',
        }, {
          Id: '3',
          FirstName: 'Minna',
          LastName: 'Noe',
          Email: 'mnoe2@wikimedia.org',
          Gender: 'Female',
        },
      ]

      const elements = values.map(value => new InstanceElement(
        value.Id,
        testType,
        value
      ))

      // eslint-disable-next-line no-restricted-syntax
      for (const element of elements) {
        yield element
      }
    }

    const mockSingleElemIdIterator = async function *mockSingleElemIdIterator(): AsyncIterable<
    ElemID> {
      const values = ['aksdjghf', 'vrwcojgg', 'skldfgjh']
      const elemIDs = values.map(value => new ElemID(
        constants.SALESFORCE,
        'test',
        'instance',
        value
      ))

      // eslint-disable-next-line no-restricted-syntax
      for (const elemID of elemIDs) {
        yield elemID
      }
    }

    describe('Import (upsert) instances of type', () => {
      it('should call the bulk API with the correct object type name', async () => {
        await adapter.importInstancesOfType(testType, mockSingleInstanceIterator())
        expect(mockLoad.mock.calls[0][0]).toEqual(testObjectType)
        expect(mockLoad.mock.calls[0][1]).toEqual('upsert')
      })
    })

    describe('Delete instances of type', () => {
      it('should call the bulk API with the correct object type name', async () => {
        await adapter.deleteInstancesOfType(testType, mockSingleElemIdIterator())
        expect(mockLoad.mock.calls[0][0]).toEqual(testObjectType)
        expect(mockLoad.mock.calls[0][1]).toEqual('delete')
      })
    })

    describe('Return correct modification result', () => {
      it('should return correct successful and failed rows number', async () => {
        mockRetrieve = jest.fn(() => Promise.resolve([
          {
            id: '1',
            success: false,
            errors: [],
          },
          {
            id: '2',
            success: true,
            errors: [],
          },
          {
            id: '3',
            success: false,
            errors: [],
          },
        ]))
        const result = await adapter.deleteInstancesOfType(testType, mockSingleElemIdIterator())
        expect(result.failedRows).toEqual(2)
        expect(result.successfulRows).toEqual(1)
      })

      it('should return correct error data from only failed results', async () => {
        mockRetrieve = jest.fn(() => Promise.resolve([
          {
            id: '1',
            success: false,
            errors: ['error1', 'error2'],
          },
          {
            id: '2',
            success: true,
            errors: ['error3', 'error4'],
          },
          {
            id: '3',
            success: false,
            errors: ['error2', 'error6'],
          },
        ]))
        const result = await adapter.deleteInstancesOfType(testType, mockSingleElemIdIterator())
        expect(result.errors.size).toEqual(3)
        expect(_.isEqual(wu(result.errors.values()).toArray(), ['error1', 'error2', 'error6'])).toBeTruthy()
      })
    })
  })
})
