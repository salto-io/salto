import _ from 'lodash'
import {
  ObjectType, InstanceElement, Element, Field, BuiltinTypes, Type, findElement,
} from 'adapter-api'
import filterCreator, { ANIMATION_FREQUENCY, ANIMATION_RULE_TYPE_ID, RECORD_TYPE_CONTEXT } from '../../src/filters/animation_rules'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'

describe('animation rules filter', () => {
  const animationRuleType = new ObjectType({
    elemID: ANIMATION_RULE_TYPE_ID,
    fields: {
      [ANIMATION_FREQUENCY]: new Field(ANIMATION_RULE_TYPE_ID, ANIMATION_FREQUENCY,
        BuiltinTypes.STRING, {
          [Type.VALUES]: ['always', 'often', 'rarely', 'sometimes'],
        }),
      [RECORD_TYPE_CONTEXT]: new Field(ANIMATION_RULE_TYPE_ID, RECORD_TYPE_CONTEXT,
        BuiltinTypes.STRING, {
          [Type.VALUES]: ['All', 'Custom', 'Master'],
        }),
    },
  })

  const mockAnimationRuleInstance = new InstanceElement('object_type', animationRuleType,
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'ObjectType',
      [ANIMATION_FREQUENCY]: 'a',
      [RECORD_TYPE_CONTEXT]: 'c',
    })

  let testElements: Element[]

  const filter = filterCreator() as FilterWith<'onFetch'>

  beforeEach(() => {
    testElements = [_.clone(mockAnimationRuleInstance), animationRuleType]
  })

  describe('on fetch', () => {
    beforeEach(async () => {
      await filter.onFetch(testElements)
    })
    it('should rename instances', async () => {
      const animationRuleInstance = findElement(testElements, mockAnimationRuleInstance.elemID) as
        InstanceElement
      expect(animationRuleInstance.value[ANIMATION_FREQUENCY]).toEqual('always')
      expect(animationRuleInstance.value[RECORD_TYPE_CONTEXT]).toEqual('Custom')
    })
  })
})
