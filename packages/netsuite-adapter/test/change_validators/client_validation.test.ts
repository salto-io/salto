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
import { Change, getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { SCRIPT_ID } from '../../src/constants'
import clientValidation from '../../src/change_validators/client_validation'
import NetsuiteClient from '../../src/client/client'
import { AdditionalDependencies } from '../../src/client/types'
import { ManifestValidationError, ObjectsValidationError } from '../../src/errors'
import { workflowType } from '../../src/autogen/types/custom_types/workflow'

describe('client validation', () => {
  let changes: Change[]

  const mockValidate = jest.fn()
  const client = {
    isSuiteAppConfigured: () => true,
    validate: mockValidate,
  } as unknown as NetsuiteClient

  beforeEach(() => {
    jest.clearAllMocks()
    changes = [toChange({
      after: new InstanceElement(
        'instanceName',
        workflowType().type,
        { [SCRIPT_ID]: 'objectName' }
      ),
    })]
  })
  it('should not have errors', async () => {
    const changeErrors = await clientValidation(
      changes, client, {} as unknown as AdditionalDependencies
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should have SDF Objects Validation Error', async () => {
    const detailedMessage = 'error on objectName'
    mockValidate.mockRejectedValue(
      new ObjectsValidationError('error message', new Map([['objectName', detailedMessage]]))
    )
    const changeErrors = await clientValidation(
      changes, client, {} as unknown as AdditionalDependencies
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'SDF Objects Validation Error',
      severity: 'Error',
    })
  })
  it('should have SDF Manifest Validation Error', async () => {
    const detailedMessage = 'manifest error'
    mockValidate.mockRejectedValue(new ManifestValidationError(detailedMessage))
    const changeErrors = await clientValidation(
      changes, client, {} as unknown as AdditionalDependencies
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'SDF Manifest Validation Error',
      severity: 'Error',
    })
  })
  it('should have general Validation Error', async () => {
    const detailedMessage = 'some error'
    mockValidate.mockRejectedValue(new Error(detailedMessage))
    const changeErrors = await clientValidation(
      changes, client, {} as unknown as AdditionalDependencies
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'Validation Error on SDF',
      severity: 'Error',
    })
  })
})
