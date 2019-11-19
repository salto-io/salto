import {
  ObjectType, ElemID, Element, InstanceElement, Value,
} from 'adapter-api'
import _ from 'lodash'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/business_process'
import * as constants from '../../src/constants'
import mockClient from '../client'

describe('validation rules filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'>

  let testElements: Element[]

  describe('Business process tests', () => {
    it('should set the order of values in a business process instance according to the opportunity stage picklist order', async () => {
      const opportunityStageElemId = new ElemID(constants.SALESFORCE, 'standard_value_set')
      const STANDARD_VALUE = 'standard_value'
      const mockOpportunityStageInstance = new InstanceElement(
        'opportunity_stage',
        new ObjectType({
          elemID: opportunityStageElemId,
        }),
        {
          [STANDARD_VALUE]: [
            {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'd',
            },
            {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'c',
            },
            {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'b',
            },
            {
              [constants.INSTANCE_FULL_NAME_FIELD]: 'a',
            },
          ],
        }
      )
      const businessProcessElemId = new ElemID(constants.SALESFORCE, 'business_process')
      const mockbusinessProcessInstance = new InstanceElement(
        'OpportunityStage',
        new ObjectType({
          elemID: businessProcessElemId,
        }),
        {
          values: [
            {
              test: 'super',
              [constants.INSTANCE_FULL_NAME_FIELD]: 'a',
            },
            {
              test: 'califragilistic',
              [constants.INSTANCE_FULL_NAME_FIELD]: 'd',
            },
            {
              test: 'expiali',
              [constants.INSTANCE_FULL_NAME_FIELD]: 'b',
            },
            {
              test: 'docious',
              [constants.INSTANCE_FULL_NAME_FIELD]: 'c',
            },
          ],
        }
      )
      testElements = [mockOpportunityStageInstance, mockbusinessProcessInstance]
      // Run filter
      await filter.onFetch(testElements)
      // Get results
      const [resultOpportunityStage, resultBusinessProcess] = testElements
      // Opportunity stage should not change
      expect(_.isEqual(mockOpportunityStageInstance, resultOpportunityStage)).toBeTruthy()
      // Verify that the order of the values of the Business Process mock is the same as the
      // Opportunity stage standard value
      expect((resultBusinessProcess as InstanceElement).value.values.map((val: { [x: string]: Value }) => val[constants.INSTANCE_FULL_NAME_FIELD])).toEqual(['d', 'c', 'b', 'a'])
    })
  })
})
