/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { workflowPropertiesValidator } from '../../src/change_validators/workflow_properties'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../src/constants'

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
        message: 'Deploy workflow instance that has properties with the same key is not allowed',
        detailedMessage: `Deploy the workflow ${instance.elemID.getFullName()} is not allowed because it has status or transition properties with the same key`,
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
        message: 'Deploy workflow instance that has properties with the same key is not allowed',
        detailedMessage: `Deploy the workflow ${instance.elemID.getFullName()} is not allowed because it has status or transition properties with the same key`,
      },
    ])
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
