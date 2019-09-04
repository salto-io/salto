import {
  ObjectType,
  ElemID,
  Field,
} from 'adapter-api'
import * as constants from '../src/constants'
import { Types } from '../src/transformer'
import { adapter } from './adapter.e2e.test';

describe('Test Salesforce adapter E2E REST API with real account', () => {
  const sfLeadName = 'Lead'
  const stringType = Types.salesforceDataTypes.text

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
