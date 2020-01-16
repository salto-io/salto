import {
  ObjectType, ElemID, InstanceElement,
} from 'adapter-api'
import makeFilter, { LAYOUT_ANNOTATION, LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { bpCase } from '../../src/transformers/transformer'

describe('Test layout filter', () => {
  const { client } = mockClient()

  const mockSObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'test'),
    annotations: {},
  })

  const filter = makeFilter({ client }) as FilterWith<'onFetch'>

  describe('Test layout fetch', () => {
    const fetch = async (apiName: string, opts = { fixedName: true }): Promise<void> => {
      const testSObj = mockSObject.clone()
      testSObj.annotate({ [constants.API_NAME]: apiName })

      const fixedName = 'Test'
      const fullName = `${apiName}-${fixedName} Layout`
      const testLayout = new InstanceElement(
        opts.fixedName ? fixedName : bpCase(fullName),
        new ObjectType({
          elemID: LAYOUT_TYPE_ID,
        }),
        { [constants.INSTANCE_FULL_NAME_FIELD]: fullName },
        [constants.RECORDS_PATH, 'Layout', bpCase(fullName)]
      )
      const elements = [testSObj, testLayout]

      await filter.onFetch(elements)

      const instance = elements[1] as InstanceElement
      expect(instance.elemID).toEqual(LAYOUT_TYPE_ID.createNestedID('instance', fixedName))
      expect(instance.path).toEqual([constants.RECORDS_PATH, 'Layout', fixedName])

      const sobject = elements[0] as ObjectType
      expect(sobject.annotations[LAYOUT_ANNOTATION][0].elemId).toEqual(instance.elemID)
    }

    it('should add relation between layout to related sobject', async () => {
      await fetch('Test')
    })
    it('should add relation between layout to related custom sobject', async () => {
      await fetch('Test__c')
    })
    it('should not transform instance name if it is already fixed', async () => {
      await fetch('Test', { fixedName: true })
    })
  })
})
