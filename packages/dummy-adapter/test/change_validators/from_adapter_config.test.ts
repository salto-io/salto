/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ObjectType, ElemID, toChange, InstanceElement, ChangeError, ChangeValidator } from '@salto-io/adapter-api'
import testParams from '../test_params'
import { GeneratorParams, ChangeErrorFromConfigFile } from '../../src/generator'
import fromAdapterConfig from '../../src/change_validators/from_adapter_config'

const mockChangeErrorFromConfig: ChangeErrorFromConfigFile = {
  elemID: 'dummy.Full.instance.myIns2',
  severity: 'Error',
  message: 'mock message',
  detailedMessage: 'mock detailedMessage',
}

const mockChangeError: ChangeError = {
  ...mockChangeErrorFromConfig,
  elemID: ElemID.fromFullName(mockChangeErrorFromConfig.elemID),
}

const objType = new ObjectType({
  elemID: ElemID.fromFullName('dummy.Full'),
})

const myInst1Change = toChange({ before: new InstanceElement('myIns1', objType) })
const myInst2Change = toChange({ before: new InstanceElement('myIns2', objType) })

const genParams: GeneratorParams = { ...testParams, changeErrors: [mockChangeErrorFromConfig] }

describe('from adapter config', () => {
  let changeValidator: ChangeValidator
  beforeEach(() => {
    changeValidator = fromAdapterConfig(genParams)
  })
  it('should return changeError when same element exists in changes list', async () => {
    expect(await changeValidator([myInst2Change])).toEqual([mockChangeError])
  })
  it('should NOT return changeError when element is not exist in changes list', async () => {
    expect(await changeValidator([myInst1Change])).toHaveLength(0)
  })
  it('should be able to handle more than 1 changeError from config', async () => {
    changeValidator = fromAdapterConfig({
      ...genParams,
      changeErrors: [mockChangeErrorFromConfig, mockChangeErrorFromConfig],
    })
    expect(await changeValidator([myInst2Change])).toHaveLength(2)
  })
})
