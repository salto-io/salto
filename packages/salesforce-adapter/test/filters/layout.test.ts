import {
  ObjectType, ElemID, InstanceElement,
} from 'adapter-api'
import makeFilter, { LAYOUT_ANNOTATION, LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { bpCase } from '../../src/transformer'

describe('Test layout filter', () => {
  const { client } = mockClient()

  const mockSObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'test'),
    annotations: {},
  })

  const filter = makeFilter({ client }) as FilterWith<'onFetch'>

  describe('Test layout fetch', () => {
    const fetch = async (apiName: string): Promise<void> => {
      const testSObj = mockSObject.clone()
      testSObj.annotate({ [constants.API_NAME]: apiName })

      const testLayout = new InstanceElement(
        bpCase(`${apiName}-Test layout`),
        new ObjectType({
          elemID: LAYOUT_TYPE_ID,
        }),
        { [constants.INSTANCE_FULL_NAME_FIELD]: `${apiName}-Test layout` },
      )
      testLayout.value[constants.INSTANCE_FULL_NAME_FIELD] = `${apiName}-Test layout`
      const elements = [testSObj, testLayout]

      await filter.onFetch(elements)

      const instance = elements[1] as InstanceElement
      expect(instance.elemID.getFullName()).toBe('salesforce.layout.instance.test')

      const sobject = elements[0] as ObjectType
      expect(sobject.annotations[LAYOUT_ANNOTATION][0]).toBe(instance.elemID.getFullName())
    }

    it('should add relation between layout to related sobject', async () => {
      await fetch('Test')
    })
    it('should add relation between layout to related custom sobject', async () => {
      await fetch('Test__c')
    })
  })
})
