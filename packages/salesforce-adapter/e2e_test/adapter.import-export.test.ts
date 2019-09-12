import {
  ObjectType,
  ElemID,
  Field,
  InstanceElement,
} from 'adapter-api'
import * as constants from '../src/constants'
import { Types } from '../src/transformer'
import realAdapter from './adapter'

describe('Adapter E2E import-export related operations with real account', () => {
  const { adapter } = realAdapter()

  const sfLeadName = 'Lead'
  const stringType = Types.salesforceDataTypes.text

  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

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
        annotationsDescriptor: {},
        annotationValues: {
          [constants.API_NAME]: sfLeadName,
        },
      })

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
    })
  })
})
