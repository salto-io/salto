/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { Transition, TransitionFrom, WorkflowV1Instance } from '../../../src/filters/workflow/types'
import { createEmptyType } from '../../utils'
import { getTransitionKey, transitionKeysToExpectedIds } from '../../../src/filters/workflow/transition_structure'
import { WorkflowVersionType } from '../../../src/filters/workflowV2/types'

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
    getTransitionKey({ transition: transition1, statusesMap: new Map(), workflowVersion: WorkflowVersionType.V1 })
    getTransitionKey({ transition: transition2, statusesMap: new Map(), workflowVersion: WorkflowVersionType.V1 })
  })
})
