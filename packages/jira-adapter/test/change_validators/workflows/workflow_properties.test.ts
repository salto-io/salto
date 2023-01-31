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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { workflowPropertiesValidator } from '../../../src/change_validators/workflows/workflow_properties'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'

describe('workflowPropertiesValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let afterInstance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    instance = new InstanceElement(
      'instance',
      type,
      {
        transitions:
        {
          properties: [
            {
              key: 'key',
              value: 'true',
            },
          ],
        },
        statuses:
        {
          properties: [
            {
              key: 'key',
              value: 'true',
            },
          ],
        },
      },
    )
    afterInstance = new InstanceElement(
      'instance',
      type,
      {
        transitions:
        [{
          properties: [
            {
              key: 'key',
              value: 'true',
            },
          ],
        }],
        statuses:
        [{
          properties: [
            {
              key: 'key',
              value: 'true',
            },
          ],
        }],
      },
    )
  })
  it('should return an error if there are transition properties with the same key', async () => {
    afterInstance.value.transitions = [{
      properties: [
        {
          key: 'key',
          value: 'true',
        },
        {
          key: 'key',
          value: 'false',
        },
      ],
    }]
    expect(await workflowPropertiesValidator([
      toChange({
        before: instance,
        after: afterInstance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can\'t deploy workflow with status or transition that have multiple properties with an identical key.',
        detailedMessage: `Can't deploy workflow ${instance.elemID.getFullName()} which has status or transition with multiple properties with an identical key.`,
      },
    ])
  })
  it('should return an error if there are statuses properties with the same key', async () => {
    afterInstance.value.statuses = [{
      properties: [
        {
          key: 'key',
          value: 'true',
        },
        {
          key: 'key',
          value: 'false',
        },
      ],
    }]
    expect(await workflowPropertiesValidator([
      toChange({
        before: instance,
        after: afterInstance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can\'t deploy workflow with status or transition that have multiple properties with an identical key.',
        detailedMessage: `Can't deploy workflow ${instance.elemID.getFullName()} which has status or transition with multiple properties with an identical key.`,
      },
    ])
  })
  it('should not return an error if the statuses and transitions are undefined', async () => {
    afterInstance.value.statuses = undefined
    afterInstance.value.transitions = undefined
    expect(await workflowPropertiesValidator([
      toChange({
        before: instance,
        after: afterInstance,
      }),
    ])).toEqual([])
  })
  it('should not return an error because there are not properties with the same key', async () => {
    expect(await workflowPropertiesValidator([
      toChange({
        before: instance,
        after: afterInstance,
      }),
    ])).toEqual([])
  })
})
