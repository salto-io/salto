import {
  ObjectType,
  ElemID,
  Field,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { Types } from '../src/transformer'
import SalesforceClient from '../src/client/client'

describe('Test Salesforce adapter E2E REST API with real account', () => {
  const sfLeadName = 'Lead'
  const stringType = Types.salesforceDataTypes.text

  const requiredEnvVar = (name: string): string => {
    const result = process.env[name]
    if (!result) {
      throw new Error(`required env var ${name} missing or empty`)
    }
    return result
  }

  const client = new SalesforceClient(
    requiredEnvVar('SF_USER'),
    requiredEnvVar('SF_PASSWORD') + requiredEnvVar('SF_TOKEN'),
    false,
  )

  const adapter = new SalesforceAdapter({ clientOrConfig: client })

  // Set long timeout as we communicate with salesforce API
  beforeAll(() => {
    jest.setTimeout(1000000)
  })

  describe('Read data', () => {
    it('should read instances of specific type', async () => {
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
        },
        annotations: {},
        annotationsValues: {
          [constants.API_NAME]: sfLeadName,
        },
      })

      const result = await adapter.getInstancesOfType(leadType)

      // Test
      expect(result[0].value.FirstName).toBeDefined()
      expect(result[0].value.LastName).toBeDefined()
    })
  })
})
