import {
  ObjectType,
  ElemID,
  Field,
  InstanceElement,
  Values,
} from 'adapter-api'
import * as constants from '../src/constants'
import { Types, apiName } from '../src/transformer'
import realAdapter from './adapter'

describe('Adapter E2E import-export related operations with real account', () => {
  const { adapter, client } = realAdapter()

  const sfLeadName = 'Lead'
  const stringType = Types.salesforceDataTypes.text

  const leadElemID = new ElemID(constants.SALESFORCE, 'lead')
  const leadType = new ObjectType({
    elemID: leadElemID,
    fields: {
      firstName: new Field(
        leadElemID,
        'First Name',
        stringType,
        {
          [constants.API_NAME]: 'FirstName',
        },
      ),
      lastName: new Field(
        leadElemID,
        'Last Name',
        stringType,
        {
          [constants.API_NAME]: 'LastName',
        },
      ),
      company: new Field(
        leadElemID,
        'Company',
        stringType,
        {
          [constants.API_NAME]: 'Company',
        },
      ),
    },
    annotationTypes: {},
    annotations: {
      [constants.API_NAME]: sfLeadName,
    },
  })

  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  describe('Read data', () => {
    it('should read instances of specific type', async () => {
      const iterator = adapter.getInstancesOfType(leadType)[Symbol.asyncIterator]()
      const firstBatch = async (): Promise<InstanceElement[]> => {
        const { done, value } = await iterator.next()
        if (done) {
          return []
        }
        return value
      }

      const results = await firstBatch()
      expect(results[0].value.FirstName).toBeDefined()
      expect(results[0].value.LastName).toBeDefined()
      expect(results[0].value.Company).toBeDefined()
    })
  })

  describe('Write data', () => {
    const existingInstances = async (instance: InstanceElement): Promise<string[]> => {
      const queryString = `SELECT Id 
      FROM ${instance.type.annotations[constants.API_NAME]} 
      WHERE 
      ${Object.keys(instance.value).filter(key => key !== 'Id')
    .map(key => `${key}='${instance.value[key]}'`).join(' AND ')}`
      const result = await client.runQuery(queryString)
      return result.records.map(record => record.Id)
    }
    it('should write instances of specific type', async () => {
      const testFirstName = 'Testy'
      const testLastName = 'Testorovich'
      const testCompany = 'Test inc.'

      const elemID = new ElemID('salesforce')
      const testInstance = new InstanceElement(
        elemID,
        leadType,
        {
          Id: '',
          FirstName: testFirstName,
          LastName: testLastName,
          Company: testCompany,
        }
      )

      const iter = async function *mockSingleInstanceIterator(): AsyncIterable<InstanceElement> {
        yield testInstance
      }

      // Prepare
      const ids = await existingInstances(testInstance)
      if (ids.length > 0) {
        await client.destroy(testInstance.type.annotations[constants.API_NAME], ids)
      }

      await adapter.importInstancesOfType(leadType, iter())

      // Test
      const queryString = `SELECT Id,${Object.values(leadType.fields).map(apiName)} 
      FROM ${apiName(leadType)} WHERE FirstName='${testFirstName}' AND LastName='${testLastName}'
      AND Company='${testCompany}'`
      const result = await client.runQuery(queryString)
      expect(result.totalSize).toBe(1)
      expect(result.done).toBeTruthy()
      expect(result.nextRecordsUrl).not.toBeDefined()
      const newLead = result.records[0] as Values
      expect(newLead.FirstName).toBe('Testy')
      expect(newLead.LastName).toBe('Testorovich')
      expect(newLead.Company).toBe('Test inc.')

      // Clean-up
      await client.destroy(testInstance.type.annotations[constants.API_NAME], newLead.Id)
    })
  })
})
