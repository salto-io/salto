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
import { toChange, ObjectType, ElemID, InstanceElement, ChangeError } from '@salto-io/adapter-api'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { circularTransitionsValidator } from '../../../src/change_validators/workflows/circular_transitions'
import { createEmptyType } from '../../utils'

const message = 'Circular workflow transitions cannot be deployed'
const detailedMessage = (transitionName: string): string => `This workflow has a transition ${transitionName} from any status to itself, which cannot be deployed due to Atlassian API limitations.
The workflow will be deployed without this transition.`
const validatorMessage = (elemID: ElemID, transitionName: string): ChangeError => ({
  elemID,
  severity: 'Warning',
  message,
  detailedMessage: detailedMessage(transitionName),
})

describe('circularTransitionsValidator', () => {
  let type: ObjectType
  let instances: InstanceElement[]

  beforeEach(() => {
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
  })
  it('should return a warning if element contains circular transition', async () => {
    expect(await circularTransitionsValidator([
      toChange({
        before: instances[1],
        after: instances[1],
      }),
    ])).toEqual([
      validatorMessage(instances[1].elemID, 'self1'),
    ])
  })
  it('should not return a warning if element does not contain circular transition', async () => {
    expect(await circularTransitionsValidator([
      toChange({
        before: instances[2],
        after: instances[2],
      }),
    ])).toEqual([])
  })
  it('should return warnings in complex situations', async () => {
    expect(await circularTransitionsValidator([
      toChange({
        before: instances[0],
        after: instances[0],
      }),
      toChange({
        before: instances[1],
        after: instances[1],
      }),
      toChange({
        before: instances[2],
        after: instances[2],
      }),
    ])).toEqual([
      validatorMessage(instances[0].elemID, 'self1'),
      validatorMessage(instances[0].elemID, 'self3'),
      validatorMessage(instances[1].elemID, 'self1'),
    ])
  })
})
