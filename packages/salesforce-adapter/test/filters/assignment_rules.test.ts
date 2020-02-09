/*
*                      Copyright 2020 Salto Labs Ltd.
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
