/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { fileType } from '../../src/types/file_cabinet_types'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import notYetSupportedChangeValidator from '../../src/change_validators/not_yet_supported_values'
import { PATH, SCRIPT_ID, NOT_YET_SUPPORTED_VALUE } from '../../src/constants'
import { mockChangeValidatorParams } from '../utils'

describe('not yet supported validator', () => {
  const origInstance = new InstanceElement('instance', workflowType().type, {
    isinactive: false,
    [SCRIPT_ID]: 'customworkflow1',
    name: 'WokrflowName',
  })
  let instance: InstanceElement

  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should not have ChangeError when deploying a file cabinet instance', async () => {
    const newFileInstance = new InstanceElement('instance', fileType(), {
      [PATH]: '/Path/to/file',
      content: NOT_YET_SUPPORTED_VALUE,
    })
    const changeErrors = await notYetSupportedChangeValidator(
      [toChange({ after: newFileInstance })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have ChangeError when deploying an instance without NOT_YET_SUPPORTED', async () => {
    const after = instance.clone()
    after.value.name = 'NewName'
    const changeErrors = await notYetSupportedChangeValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have Error ChangeError when modifying an instance with NOT_YET_SUPPORTED', async () => {
    const after = instance.clone()
    after.value.name = NOT_YET_SUPPORTED_VALUE
    const changeErrors = await notYetSupportedChangeValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
  })

  it('should have Error ChangeError when modifying an instance with value that includes NOT_YET_SUPPORTED', async () => {
    const after = instance.clone()
    after.value.name = `prefix${NOT_YET_SUPPORTED_VALUE}suffix`
    const changeErrors = await notYetSupportedChangeValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
  })

  it('should not have Error if NOT_YET_SUPPORTED was changed to a concrete value', async () => {
    const before = instance.clone()
    before.value.name = NOT_YET_SUPPORTED_VALUE
    const changeErrors = await notYetSupportedChangeValidator(
      [toChange({ before, after: instance })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })
})
