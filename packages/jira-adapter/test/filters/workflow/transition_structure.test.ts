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

import { InstanceElement } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { Transition, TransitionFrom, WorkflowV1Instance } from '../../../src/filters/workflow/types'
import { createEmptyType } from '../../utils'
import { getTransitionKey, transitionKeysToExpectedIds } from '../../../src/filters/workflow/transition_structure'

const keys = {
  t1: naclCase('transition1::From: Open::Directed'),
  t2: naclCase('transition2::From: none::Initial'),
  t3: naclCase('transition3::From: any status::Circular'),
  t4: naclCase('transition4::From: Closed::Directed'),
  t5: naclCase('transition5::From: any status::Global'),
}

describe('transitionKeysToExpectedIds', () => {
  it('should return a map with expected transition IDs for each transition key', () => {
    const workflowInstance: WorkflowV1Instance = new InstanceElement('instance', createEmptyType('Workflow'), {
      transitions: {
        [keys.t1]: { name: 'transition1' },
        [keys.t2]: { name: 'transition2' },
        [keys.t3]: { name: 'transition3' },
        [keys.t4]: { name: 'transition4' },
        [keys.t5]: { name: 'transition5' },
      },
    }) as WorkflowV1Instance
    const result = transitionKeysToExpectedIds(workflowInstance)
    expect(result.get(keys.t1)).toEqual('31')
    expect(result.get(keys.t2)).toEqual('1')
    expect(result.get(keys.t3)).toEqual('11')
    expect(result.get(keys.t4)).toEqual('41')
    expect(result.get(keys.t5)).toEqual('21')
  })

  it('should handle empty transition groups', () => {
    const workflowInstance: WorkflowV1Instance = new InstanceElement('instance', createEmptyType('Workflow'), {
      transitions: {},
    }) as WorkflowV1Instance

    const result = transitionKeysToExpectedIds(workflowInstance)

    expect(result).toEqual(new Map())
  })
  it('should handle wrong transition keys', () => {
    const workflowInstance: WorkflowV1Instance = new InstanceElement('instance', createEmptyType('Workflow'), {
      transitions: {
        '': { name: 'transition1' },
      },
    }) as WorkflowV1Instance

    const result = transitionKeysToExpectedIds(workflowInstance)

    expect(result).toEqual(new Map())
  })
  it('add to coverage', () => {
    const transition1: Transition = {
      from: ['hello'],
      name: 'transition1',
    }
    const transition2: Transition = {
      from: [{} as TransitionFrom],
      name: 'transition1',
    }
    getTransitionKey(transition1, new Map())
    getTransitionKey(transition2, new Map())
  })
})
