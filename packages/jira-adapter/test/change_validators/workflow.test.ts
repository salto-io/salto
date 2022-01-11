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
import { workflowValidator } from '../../src/change_validators/workflow'
import { JIRA } from '../../src/constants'

describe('workflowValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'Workflow') })
    instance = new InstanceElement('instance', type)
  })
  it('should return an error if there is a non-deployable post function', async () => {
    instance.value.transitions = [{
      rules: {
        postFunctions: [
          {
            type: 'com.onresolve.jira.groovy.groovyrunner__script-postfunction',
          },
        ],
      },
    }]

    expect(await workflowValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: `Salto does not support deploying script-runner configuration in the instance ${instance.elemID.getFullName()}`,
        detailedMessage: 'Salto does not support deploying script-runner (com.onresolve.jira.groovy.groovyrunner) configuration. If continuing, they will be omitted from the deployment',
      },
    ])
  })

  it('should return an error if there is a non-deployable validator', async () => {
    instance.value.transitions = [{
      rules: {
        validators: [
          {
            type: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators',
          },
        ],
      },
    }]

    expect(await workflowValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: `Salto does not support deploying script-runner configuration in the instance ${instance.elemID.getFullName()}`,
        detailedMessage: 'Salto does not support deploying script-runner (com.onresolve.jira.groovy.groovyrunner) configuration. If continuing, they will be omitted from the deployment',
      },
    ])
  })

  it('should not return an error if workflow is valid', async () => {
    instance.value.transitions = [{
      rules: {
        postFunctions: [
          {
            type: 'other',
          },
          {
            val: 'val',
          },
        ],
        validators: [
          {
            type: 'other',
          },
          {
            val: 'val',
          },
        ],
      },
    }]

    expect(await workflowValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error if there are no transitions', async () => {
    expect(await workflowValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
  it('should not return an error if there are no rules', async () => {
    instance.value.transitions = [{
      val: 'val',
    }]
    expect(await workflowValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
