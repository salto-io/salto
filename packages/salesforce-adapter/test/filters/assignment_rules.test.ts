import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element,
} from 'adapter-api'
import { filter, ASSIGNMENT_RULES_TYPE_NAME } from '../../src/filters/assignment_rules'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformer'

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

  beforeEach(() => {
    testElements = [
      _.clone(mockRuleInstance),
    ]
  })

  describe('on discover', () => {
    it('should rename instances', async () => {
      await filter.onDiscover(client, testElements)
      const [rulesInstance] = testElements
      expect(rulesInstance.elemID.name).toEqual('lead_assignment_rules')
    })
  })

  describe('on add', () => {
    it('should have no effect', async () => {
      expect(await filter.onAdd(client, mockRuleInstance)).toHaveLength(0)
    })
  })

  describe('on update', () => {
    it('should have no effect', async () => {
      expect(await filter.onUpdate(client, mockRuleInstance, mockRuleInstance)).toHaveLength(0)
    })
  })

  describe('on remove', () => {
    it('should have no effect', async () => {
      expect(await filter.onRemove(client, mockRuleInstance)).toHaveLength(0)
    })
  })
})
