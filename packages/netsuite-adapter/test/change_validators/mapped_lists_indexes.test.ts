/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import mappedListsIndexesValidator from '../../src/change_validators/mapped_lists_indexes'
import { SCRIPT_ID } from '../../src/constants'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import { convertFieldsTypesFromListToMap } from '../../src/mapped_lists/utils'
import { mockChangeValidatorParams } from '../utils'

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
    instance = new InstanceElement('instance', workflow.type, {
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
    })
  })

  it('should not have ChangeError when deploying an instance without mapped lists', async () => {
    const after = instance.clone()
    after.value.workflowcustomfields = {}
    const changeErrors = await mappedListsIndexesValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
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
    await expect(
      mappedListsIndexesValidator([toChange({ after: customSegmentInstance })], mockChangeValidatorParams()),
    ).resolves.toHaveLength(0)
  })

  it('should not have ChangeError when deploying an instance with correct indexes', async () => {
    const after = instance.clone()
    after.value.name = 'NewName'
    const changeErrors = await mappedListsIndexesValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
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
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(4)
    expect(changeErrors[0]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow1'),
      severity: 'Warning',
      message:
        'The missing index value will be set to the end of the list in the next fetch. No action item is required.',
      detailedMessage:
        'The index value of custworkflow1 is missing, we will set it to 5 in the next fetch. No action item is required.',
    })
    expect(changeErrors[1]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow2'),
      severity: 'Warning',
      message: 'The index value will be changed in the next fetch. No action item is required.',
      detailedMessage:
        'The index value of custworkflow2 is not an integer, we will change it in the next fetch to a valid integer value. No action item is required.',
    })
    expect(changeErrors[2]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield', 'custworkflow3'),
      severity: 'Warning',
      message: 'The index value will be changed in the next fetch. No action item is required.',
      detailedMessage:
        'The index value of custworkflow3 is out of range, we will change it in the next fetch to a valid integer value. No action item is required.',
    })
    expect(changeErrors[3]).toEqual({
      elemID: after.elemID.createNestedID('workflowcustomfields', 'workflowcustomfield'),
      severity: 'Warning',
      message: 'The index value is not unique and will be changed in the next fetch. No action item is required.',
      detailedMessage:
        'The index value of custworkflow5 is not unique. We will sort the elements in workflowcustomfield that share the index 2 by their key name, and change their index in the next fetch. No action item is required.',
    })
  })
})
