import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element,
} from 'adapter-api'
import filterCreator, { ASSIGNMENT_RULES_TYPE_NAME } from '../../src/filters/assignment_rules'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformer'
import { FilterWith } from '../../src/filter'

jest.mock('../../src/client/client')

describe('Test layout filter', () => {
  const client = new SalesforceClient('', '', false)

  const mockRuleInstance = new InstanceElement(
    new ElemID(constants.SALESFORCE, ASSIGNMENT_RULES_TYPE_NAME, 'lead'),
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, ASSIGNMENT_RULES_TYPE_NAME),
    }),
    {
      [bpCase(constants.METADATA_OBJECT_NAME_FIELD)]: 'Lead',
    },
  )

  let testElements: Element[]

  const filter = filterCreator({ client }) as FilterWith<'onDiscover'>

  beforeEach(() => {
    testElements = [
      _.clone(mockRuleInstance),
    ]
  })

  describe('on discover', () => {
    it('should rename instances', async () => {
      await filter.onDiscover(testElements)
      const [rulesInstance] = testElements
      expect(rulesInstance.elemID.name).toEqual('lead_assignment_rules')
    })
  })
})
