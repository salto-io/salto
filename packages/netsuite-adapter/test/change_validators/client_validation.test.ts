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
import { Change, ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { Filter } from '../../src/filter'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import clientValidation from '../../src/change_validators/client_validation'
import NetsuiteClient from '../../src/client/client'
import { AdditionalDependencies } from '../../src/client/types'
import { ManifestValidationError, ObjectsDeployError, SettingsDeployError } from '../../src/errors'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'

describe('client validation', () => {
  let changes: Change[]

  const mockValidate = jest.fn()
  const client = {
    isSuiteAppConfigured: () => true,
    validate: mockValidate,
  } as unknown as NetsuiteClient

  const mockFiltersRunner = {
    onFetch: jest.fn(),
    preDeploy: jest.fn(),
  } as unknown as Required<Filter>

  const mockElementsSourceIndex = {} as unknown as LazyElementsSourceIndexes

  beforeEach(() => {
    jest.clearAllMocks()
    changes = [
      toChange({
        after: new InstanceElement(
          'instanceName',
          workflowType().type,
          { [SCRIPT_ID]: 'object_name' }
        ),
      }), toChange({
        after: new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotations: {
            [SCRIPT_ID]: 'customrecord1',
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          },
        }),
      }),
    ]
  })
  it('should not have errors', async () => {
    mockValidate.mockReturnValue([])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
      mockElementsSourceIndex
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should have SDF Objects Validation Error for instance', async () => {
    const detailedMessage = `An error occurred during custom object validation. (object_name)
Details: The object field daterange is missing.
Details: The object field kpi must not be OPENJOBS.
Details: The object field periodrange is missing.
Details: The object field compareperiodrange is missing.
Details: The object field defaultgeneraltype must not be ENTITY_ENTITY_NAME.
Details: The object field type must not be 449.
File: ~/Objects/object_name.xml`
    const fullErrorMessage = `Validation failed.\n\n${detailedMessage}`
    mockValidate.mockReturnValue([
      new ObjectsDeployError(fullErrorMessage, new Set(['object_name'])),
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
      mockElementsSourceIndex
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'SDF Objects Validation Error',
      severity: 'Error',
    })
  })
  it('should have SDF Objects Validation Error for customRecordType', async () => {
    const detailedMessage = `An error occurred during custom object validation. (customrecord1)
Details: The object field daterange is missing.
Details: The object field kpi must not be OPENJOBS.
Details: The object field periodrange is missing.
Details: The object field compareperiodrange is missing.
Details: The object field defaultgeneraltype must not be ENTITY_ENTITY_NAME.
Details: The object field type must not be 449.
File: ~/Objects/customrecord1.xml`
    const fullErrorMessage = `Validation failed.\n\n${detailedMessage}`
    mockValidate.mockReturnValue([
      new ObjectsDeployError(fullErrorMessage, new Set(['customrecord1'])),
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
      mockElementsSourceIndex
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[1]).elemID,
      message: 'SDF Objects Validation Error',
      severity: 'Error',
    })
  })
  it('should have SDF Manifest Validation Error', async () => {
    const detailedMessage = 'manifest error'
    mockValidate.mockReturnValue([new ManifestValidationError(detailedMessage)])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
      mockElementsSourceIndex
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'SDF Manifest Validation Error',
      severity: 'Error',
    })
  })
  it('should have general Validation Error', async () => {
    const detailedMessage = 'some error'
    mockValidate.mockReturnValue([new Error(detailedMessage)])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
      mockElementsSourceIndex
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'Validation Error on SDF',
      severity: 'Error',
    })
  })

  it('should have settings deploy error for a specific change', async () => {
    const detailedMessage = 'Validation of account settings failed.'
    mockValidate.mockReturnValue([new SettingsDeployError(`${detailedMessage}`, new Set(['workflow']))])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
      mockElementsSourceIndex
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'SDF Settings Validation Error',
      severity: 'Error',
    })
  })
  it('should have settings deploy error for all changes', async () => {
    const detailedMessage = 'Validation of account settings failed.'
    mockValidate.mockReturnValue([new SettingsDeployError(`${detailedMessage}`, new Set(['abc']))])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
      mockElementsSourceIndex
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual(changes.map(change => ({
      detailedMessage,
      elemID: getChangeData(change).elemID,
      message: 'SDF Settings Validation Error',
      severity: 'Error',
    })))
  })
})
