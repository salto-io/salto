import {
  ObjectType, ElemID, InstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import { aspect, LAYOUT_ANNOTATION, LAYOUT_TYPE_NAME } from '../../src/aspects/layouts'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformer'

jest.mock('../../src/client/client')

describe('Test layout aspect', () => {
  const mockSObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'test'),
    annotationsValues: {},
  })

  const mockLayout = new InstanceElement(
    new ElemID(constants.SALESFORCE, LAYOUT_TYPE_NAME, 'test_test_layout'),
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, LAYOUT_TYPE_NAME, constants.METADATA_TYPES_SUFFIX),
    }),
    {},
  )

  describe('Test layout discover', () => {
    const discover = async (apiName: string): Promise<void> => {
      const testSObj = mockSObject.clone()
      testSObj.annotate({ [constants.API_NAME]: apiName })
      const testLayout = _.clone(mockLayout)
      testLayout.value[bpCase(constants.METADATA_OBJECT_NAME_FIELD)] = `${apiName}-Test layout`
      const elements = [testSObj, testLayout]

      await aspect.discover(new SalesforceClient('', '', false), elements)
      const sobject = elements[0] as ObjectType
      expect(sobject.annotationsValues[LAYOUT_ANNOTATION][0])
        .toBe(mockLayout.elemID.getFullName())
    }

    it('should add relation between layout to related sobject', async () => {
      await discover('Test')
    })
    it('should add relation between layout to related custom sobject', async () => {
      await discover('Test__c')
    })
  })
})
