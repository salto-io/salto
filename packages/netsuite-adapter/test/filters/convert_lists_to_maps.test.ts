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
import { InstanceElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/convert_lists_to_maps'
import { getCustomTypes } from '../../src/autogen/types'
import { getInnerCustomTypes, getTopLevelCustomTypes } from '../../src/types'

describe('convert lists to maps filter', () => {
  const instanceName = 'instanceName'
  const customTypes = getCustomTypes()
  let instance: InstanceElement
  beforeAll(async () => {
    instance = new InstanceElement(instanceName,
      customTypes.workflow.type,
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
    await filterCreator().onFetch([
      ...getTopLevelCustomTypes(customTypes),
      ...getInnerCustomTypes(customTypes),
      instance,
    ])
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

  it('should throw when missing some types with field mapping', async () => {
    await expect(filterCreator().onFetch([
      customTypes.workflow.type,
      ...Object.values(customTypes.workflow.innerTypes),
      instance,
    ])).rejects.toThrow('missing some types with field mapping')
  })
})
