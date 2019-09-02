import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element,
} from 'adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  VALIDATION_RULE_TYPE, VALIDATION_RULE_ANNOTATION,
} from '../../src/filters/validation_rules'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformer'

jest.mock('../../src/client/client')

describe('Test layout filter', () => {
  const client = new SalesforceClient('', '', false)
  const filter = filterCreator({ client }) as FilterWith<'onDiscover'>

  const mockSObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'test'),
    annotationsValues: {},
  })

  const mockValidationRule = new InstanceElement(
    new ElemID(constants.SALESFORCE, VALIDATION_RULE_TYPE, 'test__c_validate_stuff'),
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, VALIDATION_RULE_TYPE),
    }),
    {
      [bpCase(constants.METADATA_OBJECT_NAME_FIELD)]: 'Test__c.validate_stuff',
    },
  )

  let testElements: Element[]

  beforeEach(() => {
    testElements = [
      mockSObject.clone(),
      _.clone(mockValidationRule),
    ]
  })

  describe('validation rule discover', () => {
    it('should add relation between validation rule to related sobject', async () => {
      await filter.onDiscover(testElements)
      const [sobject] = testElements
      expect(sobject.getAnnotationsValues()[VALIDATION_RULE_ANNOTATION]).toEqual(
        [mockValidationRule.elemID.getFullName()]
      )
    })
  })
})
