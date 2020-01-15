import _ from 'lodash'
import {
  ObjectType, InstanceElement, Element,
} from 'adapter-api'
import filterCreator, { ASSIGNMENT_RULES_TYPE_ID } from '../../src/filters/assignment_rules'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('assignment rules filter', () => {
  const { client } = mockClient()

  const mockRuleInstance = new InstanceElement(
    'lead',
    new ObjectType({
      elemID: ASSIGNMENT_RULES_TYPE_ID,
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Lead',
    },
  )

  let testElements: Element[]

  const filter = filterCreator({ client }) as FilterWith<'onFetch'>

  beforeEach(() => {
    testElements = [
      _.clone(mockRuleInstance),
    ]
  })

  describe('on fetch', () => {
    it('should rename instances', async () => {
      await filter.onFetch(testElements)
      const [rulesInstance] = testElements
      expect(rulesInstance.elemID.name).toEqual('LeadAssignmentRules')
    })
  })
})
