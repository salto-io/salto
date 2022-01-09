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
import { collections } from '@salto-io/lowerdash'
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import mappedListsIndexesValidator from '../../src/change_validators/mapped_lists_indexes'
import { SCRIPT_ID } from '../../src/constants'
import { workflow, workflowInnerTypes } from '../../src/autogen/types/custom_types/workflow'
import { convertFieldsTypesFromListToMap } from '../../src/mapped_lists/utils'

const { awu } = collections.asynciterable

describe('mapped lists indexes validator', () => {
  const origInstance = new InstanceElement(
    'instance',
    workflow,
    {
      isinactive: false,
      [SCRIPT_ID]: 'customworkflow1',
      name: 'WokrflowName',
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
    }
  )
  let instance: InstanceElement
  beforeAll(async () => {
    await awu(workflowInnerTypes).forEach(t => convertFieldsTypesFromListToMap(t))
  })
  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should not have ChangeError when deploying an instance without mapped lists', async () => {
    const after = instance.clone()
    after.value.workflowcustomfields = {}
    const changeErrors = await mappedListsIndexesValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have ChangeError when deploying an instance with correct indexes', async () => {
    const after = instance.clone()
    after.value.name = 'NewName'
    const changeErrors = await mappedListsIndexesValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have ChangeErrors when indexes are wrong', async () => {
    const after = instance.clone()
    after.value.workflowcustomfields = {
      workflowcustomfield: {
        custworkflow1: {
          scriptid: 'custworkflow1',
        },
        custworkflow2: {
          scriptid: 'custworkflow2',
          index: '1',
        },
        custworkflow3: {
          scriptid: 'custworkflow3',
          index: 10,
        },
        custworkflow4: {
          scriptid: 'custworkflow4',
          index: 2,
        },
        custworkflow5: {
          scriptid: 'custworkflow5',
          index: 2,
        },
      },
    }
    const changeErrors = await mappedListsIndexesValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(4)
    expect(changeErrors[0]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow1'),
      severity: 'Error',
      message: 'invalid index attribute in a mapped list',
      detailedMessage: 'custworkflow1 has no \'index\' attribute',
    })
    expect(changeErrors[1]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow2'),
      severity: 'Error',
      message: 'invalid index attribute in a mapped list',
      detailedMessage: 'index is not an integer',
    })
    expect(changeErrors[2]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow3'),
      severity: 'Error',
      message: 'invalid index attribute in a mapped list',
      detailedMessage: 'index is out of range',
    })
    expect(changeErrors[3]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield'),
      severity: 'Error',
      message: 'invalid index attribute in a mapped list',
      detailedMessage: 'some items has the same index value (index = 2)',
    })
  })
})
