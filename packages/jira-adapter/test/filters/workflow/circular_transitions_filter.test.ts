/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { Change, InstanceElement, ObjectType, getChangeData } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { createEmptyType, getFilterParams } from '../../utils'
import circularTransitionsFilter from '../../../src/filters/workflow/circular_transitions_filter'

describe('circular transitions filter', () => {
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let type: ObjectType
  let instances: InstanceElement[]
  let changes: Change<InstanceElement>[]
  beforeEach(async () => {
    type = createEmptyType(WORKFLOW_TYPE_NAME)
    instances = []
    instances[0] = new InstanceElement(
      'instance1',
      type,
      {
        name: 'instance1',
        transitions: [
          {
            name: 'self1',
            to: '',
          },
          {
            name: 'reg2',
            from: ['from'],
            to: 'to',
          },
          {
            name: 'self3',
            to: '',
          },
          {
            name: 'reg4',
            to: 'to',
          },
          {
            name: 'reg5',
            from: ['from'],
            to: '',
          },
        ],
      },
    )
    instances[1] = new InstanceElement(
      'instance2',
      type,
      {
        name: 'instance2',
        transitions: [
          {
            name: 'self1',
            to: '',
          },
        ],
      },
    )
    instances[2] = new InstanceElement(
      'instance3',
      type,
      {
        name: 'instance3',
        transitions: [
          {
            name: 'reg1',
            to: 'to',
            from: ['from'],
          },
        ],
      },
    )
    filter = circularTransitionsFilter(getFilterParams()) as typeof filter
    changes = instances.map(instance => ({ action: 'add', data: { after: instance } }))
  })

  describe('preDeploy', () => {
    it('should remove circular transitions', async () => {
      await filter.preDeploy([changes[1]])
      expect(getChangeData(changes[1]).value.transitions.length).toEqual(0)
    })

    it('should not remove regular transitions', async () => {
      await filter.preDeploy([changes[2]])
      expect(getChangeData(changes[2]).value.transitions.length).toEqual(1)
    })
    it('should handle complex objects correctly', async () => {
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.transitions).toEqual(
        [
          {
            name: 'reg2',
            from: ['from'],
            to: 'to',
          },
          {
            name: 'reg4',
            to: 'to',
          },
          {
            name: 'reg5',
            from: ['from'],
            to: '',
          },
        ]
      )
      expect(getChangeData(changes[1]).value.transitions.length).toEqual(0)
      expect(getChangeData(changes[2]).value.transitions.length).toEqual(1)
    })
  })
  describe('onDeploy', () => {
    it('should not change the changes', async () => {
      const changesCopy = changes.map(change => ({ ...change }))
      await filter.preDeploy(changes) // to fill the cache
      await filter.onDeploy(changes)
      expect(changes).toEqual(changesCopy)
    })
  })
})
