import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element,
} from 'adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  VALIDATION_RULE_TYPE_ID, VALIDATION_RULE_ANNOTATION,
} from '../../src/filters/validation_rules'
import * as constants from '../../src/constants'
import mockClient from '../client'
import { id } from '../../src/filters/utils'

describe('validation rules filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'>

  const mockSObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'test__c'),
    annotations: {
      [constants.API_NAME]: 'Test__c',
    },
  })

  const mockValidationRule = new InstanceElement(
    'test__c_validate_stuff',
    new ObjectType({
      elemID: VALIDATION_RULE_TYPE_ID,
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Test__c.validate_stuff',
    },
  )

  let testElements: Element[]

  beforeEach(() => {
    testElements = [
      mockSObject.clone(),
      _.clone(mockValidationRule),
    ]
  })

  describe('validation rule fetch', () => {
    it('should add relation between validation rule to related sobject', async () => {
      await filter.onFetch(testElements)
      const [sobject] = testElements
      expect(sobject.annotations[VALIDATION_RULE_ANNOTATION]).toEqual(
        [id(mockValidationRule)]
      )
    })
  })
})
