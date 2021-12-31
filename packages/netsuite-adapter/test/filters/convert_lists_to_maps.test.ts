/*
*                      Copyright 2021 Salto Labs Ltd.
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
import filterCreator from '../../src/filters/convert_lists_to_maps'
import { workflow, workflowInnerTypes } from '../../src/autogen/types/custom_types/workflow'

describe('convert_lists filter', () => {
  const instanceName = 'instanceName'
  let instance: InstanceElement
  beforeAll(async () => {
    instance = new InstanceElement(instanceName,
      workflow,
      {
        scriptid: 'customworkflow_changed_id',
        workflowcustomfields: {
          workflowcustomfield: [
            {
              scriptid: 'custworkflow1',
            },
            {
              scriptid: 'custworkflow2',
            },
          ],
        },
        workflowstates: {
          workflowstate: [
            {
              scriptid: 'workflowstate1',
              workflowactions: [
                {
                  triggertype: 'ONENTRY',
                },
              ],
            },
          ],
        },
      })
    await filterCreator().onFetch([workflow, ...workflowInnerTypes, instance])
  })

  it('should modify instance values', () => {
    expect(instance.value).toEqual({
      scriptid: 'customworkflow_changed_id',
      workflowcustomfields: {
        workflowcustomfield: {
          custworkflow1: {
            scriptid: 'custworkflow1',
            index: 0,
          },
          custworkflow2: {
            scriptid: 'custworkflow2',
            index: 1,
          },
        },
      },
      workflowstates: {
        workflowstate: {
          workflowstate1: {
            scriptid: 'workflowstate1',
            index: 0,
            workflowactions: {
              ONENTRY: {
                triggertype: 'ONENTRY',
                index: 0,
              },
            },
          },
        },
      },
    })
  })
})
