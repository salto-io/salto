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
import { collections } from '@salto-io/lowerdash'
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import mappedListsIndexesValidator from '../../src/change_validators/mapped_lists_indexes'
import { SCRIPT_ID } from '../../src/constants'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import { convertFieldsTypesFromListToMap } from '../../src/mapped_lists/utils'

const { awu } = collections.asynciterable

describe('mapped lists indexes validator', () => {
  const workflow = workflowType()
  const customsegment = customsegmentType()
  let instance: InstanceElement
  beforeAll(async () => {
    await awu(Object.values(workflow.innerTypes)).forEach(t => convertFieldsTypesFromListToMap(t))
    await awu(Object.values(customsegment.innerTypes)).forEach(t => convertFieldsTypesFromListToMap(t))
  })
  beforeEach(() => {
    instance = new InstanceElement(
      'instance',
      workflow.type,
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
  })

  it('should not have ChangeError when deploying an instance without mapped lists', async () => {
    const after = instance.clone()
    after.value.workflowcustomfields = {}
    const changeErrors = await mappedListsIndexesValidator(
      [toChange({ before: instance, after })]
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not have ChangeError when deploying an instance with unordered list', async () => {
    const customSegmentInstance = new InstanceElement('cseg1', customsegment.type, {
      scriptid: 'cseg1',
      permissions: {
        permission: {
          ADMINISTRATOR: {
            role: 'ADMINISTRATOR',
            valuemgmtaccesslevel: 'ALL',
          },
        },
      },
    })
    await expect(mappedListsIndexesValidator([toChange({ after: customSegmentInstance })])).resolves.toHaveLength(0)
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
      severity: 'Warning',
      message: 'Invalid index attribute in a mapped list',
      detailedMessage: 'custworkflow1 has no \'index\' attribute. It is going to be located at the end of the list (index = 5).',
    })
    expect(changeErrors[1]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow2'),
      severity: 'Warning',
      message: 'Invalid index attribute in a mapped list',
      detailedMessage: 'Index is not an integer. It will be override by an integer value in the next fetch.',
    })
    expect(changeErrors[2]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow3'),
      severity: 'Warning',
      message: 'Invalid index attribute in a mapped list',
      detailedMessage: 'Index is out of range. It will be override by an in-range value in the next fetch.',
    })
    expect(changeErrors[3]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield'),
      severity: 'Warning',
      message: 'Invalid index attribute in a mapped list',
      detailedMessage: 'Some items has the same index value (index = 2). They will be sorted by their key name (custworkflow5).',
    })
  })
})
