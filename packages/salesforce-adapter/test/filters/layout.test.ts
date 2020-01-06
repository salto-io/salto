import {
  ObjectType, ElemID, InstanceElement, ReferenceExpression,
} from 'adapter-api'
import makeFilter, { LAYOUT_ANNOTATION, LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { bpCase } from '../../src/transformers/transformer'
import { id } from '../../src/filters/utils'

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

      const fullName = `${apiName}-Test layout`
      const testLayout = new InstanceElement(
        opts.fixedName ? 'test' : bpCase(fullName),
        new ObjectType({
          elemID: LAYOUT_TYPE_ID,
        }),
        { [constants.INSTANCE_FULL_NAME_FIELD]: fullName },
        ['records', 'layout', bpCase(fullName)]
      )
      testLayout.value[constants.INSTANCE_FULL_NAME_FIELD] = `${apiName}-Test layout`
      const elements = [testSObj, testLayout]

      await filter.onFetch(elements)

      const instance = elements[1] as InstanceElement
      expect(id(instance)).toBe('salesforce.layout.instance.test')
      expect(instance.path?.join()).toBe('records,layout,test')

      const sobject = elements[0] as ObjectType
      expect((sobject.annotations[LAYOUT_ANNOTATION][0] as ReferenceExpression).traversalParts)
        .toEqual([...id(instance).split('.'), constants.INSTANCE_FULL_NAME_FIELD])
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
