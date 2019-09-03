import {
  ObjectType,
  ElemID,
  InstanceElement,
  Field,
} from 'adapter-api'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { Types } from '../src/transformer'

describe('Test Salesforce adapter E2E REST API with real account', () => {
  const adapter = (): SalesforceAdapter => {
    const a = new SalesforceAdapter()
    const configType = a.getConfigType()
    const value = {
      username: process.env.SF_USER,
      password: process.env.SF_PASSWORD,
      token: process.env.SF_TOKEN,
      sandbox: false,
    }
    const elemID = new ElemID('salesforce')
    const config = new InstanceElement(elemID, configType, value)
    a.init(config)
    return a
  }

  const sfLeadName = 'Lead'
  const stringType = Types.salesforceDataTypes.text

  // Set long timeout as we communicate with salesforce API
  beforeAll(() => {
    jest.setTimeout(1000000)
  })

  describe('Read data', () => {
    const sfAdapter = adapter()
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

      const result = await sfAdapter.getInstancesOfType(leadType)

      // Test
      expect(result[0].value.FirstName).toBeDefined()
      expect(result[0].value.LastName).toBeDefined()
    })
  })
})
