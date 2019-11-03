import {
  ObjectType, ElemID, InstanceElement, Type,
} from 'adapter-api'
import _ from 'lodash'
import makeFilter, { LAYOUT_ANNOTATION, LAYOUT_TYPE_NAME } from '../../src/filters/layouts'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformer'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('Test layout filter', () => {
  const { client } = mockClient()

  const mockSObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'test'),
    annotations: {},
  })

  const mockLayout = new InstanceElement(
    new ElemID(constants.SALESFORCE, LAYOUT_TYPE_NAME, 'test_test_layout'),
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, LAYOUT_TYPE_NAME),
    }),
    {},
  )

  const filter = makeFilter({ client }) as FilterWith<'onFetch'>

  describe('Test layout fetch', () => {
    const fetch = async (apiName: string): Promise<void> => {
      const testSObj = mockSObject.clone()
      testSObj.annotate({ [Type.SERVICE_ID]: apiName })
      const testLayout = _.clone(mockLayout)
      testLayout.value[bpCase(constants.METADATA_OBJECT_NAME_FIELD)] = `${apiName}-Test layout`
      const elements = [testSObj, testLayout]

      await filter.onFetch(elements)
      const sobject = elements[0] as ObjectType
      expect(sobject.annotations[LAYOUT_ANNOTATION][0])
        .toBe(mockLayout.elemID.getFullName())
    }

    it('should add relation between layout to related sobject', async () => {
      await fetch('Test')
    })
    it('should add relation between layout to related custom sobject', async () => {
      await fetch('Test__c')
    })
  })
})
