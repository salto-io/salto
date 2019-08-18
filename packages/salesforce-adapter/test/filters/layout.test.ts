import {
  ObjectType, ElemID, InstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import { filter, LAYOUT_ANNOTATION, LAYOUT_TYPE_NAME } from '../../src/filters/layouts'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformer'

jest.mock('../../src/client/client')

describe('Test layout filter', () => {
  const mockSObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'test'),
    annotationsValues: {},
  })

  const mockLayout = new InstanceElement(
    new ElemID(constants.SALESFORCE, LAYOUT_TYPE_NAME, 'test_test_layout'),
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, LAYOUT_TYPE_NAME),
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

      await filter.onDiscover(new SalesforceClient('', '', false), elements)
      const sobject = elements[0] as ObjectType
      expect(sobject.getAnnotationsValues()[LAYOUT_ANNOTATION][0])
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
