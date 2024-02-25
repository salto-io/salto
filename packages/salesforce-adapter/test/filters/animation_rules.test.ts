/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash'
import {
  ObjectType,
  InstanceElement,
  Element,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRestriction,
} from '@salto-io/adapter-api'
import { findElement } from '@salto-io/adapter-utils'
import filterCreator, {
  ANIMATION_FREQUENCY,
  ANIMATION_RULE_TYPE_ID,
  RECORD_TYPE_CONTEXT,
} from '../../src/filters/animation_rules'
import * as constants from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('animation rules filter', () => {
  const animationRuleType = new ObjectType({
    elemID: ANIMATION_RULE_TYPE_ID,
    fields: {
      [ANIMATION_FREQUENCY]: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: ['always', 'often', 'rarely', 'sometimes'],
          }),
        },
      },
      [RECORD_TYPE_CONTEXT]: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: ['All', 'Custom', 'Master'],
          }),
        },
      },
    },
  })

  const mockAnimationRuleInstance = new InstanceElement(
    'object_type',
    animationRuleType,
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'ObjectType',
      [ANIMATION_FREQUENCY]: 'a',
      [RECORD_TYPE_CONTEXT]: 'c',
    },
  )

  let testElements: Element[]

  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>

  beforeEach(() => {
    testElements = [_.clone(mockAnimationRuleInstance), animationRuleType]
  })

  describe('on fetch', () => {
    it('should rename instances', async () => {
      await filter.onFetch(testElements)
      const animationRuleInstance = findElement(
        testElements,
        mockAnimationRuleInstance.elemID,
      ) as InstanceElement
      expect(animationRuleInstance.value[ANIMATION_FREQUENCY]).toEqual('always')
      expect(animationRuleInstance.value[RECORD_TYPE_CONTEXT]).toEqual('Custom')
    })
    it('should not rename if value is not short', async () => {
      const animationRuleInstance = findElement(
        testElements,
        mockAnimationRuleInstance.elemID,
      ) as InstanceElement
      animationRuleInstance.value[ANIMATION_FREQUENCY] = 'often'
      animationRuleInstance.value[RECORD_TYPE_CONTEXT] = 'Master'
      await filter.onFetch(testElements)
      expect(animationRuleInstance.value[ANIMATION_FREQUENCY]).toEqual('often')
      expect(animationRuleInstance.value[RECORD_TYPE_CONTEXT]).toEqual('Master')
    })
  })
})
