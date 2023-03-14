/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, Change, ElemID, Field, getChangeData, InstanceElement, isObjectTypeChange, ObjectType, toChange } from '@salto-io/adapter-api'
import { Filter } from '../../src/filter'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import clientValidation from '../../src/change_validators/client_validation'
import NetsuiteClient from '../../src/client/client'
import { AdditionalDependencies } from '../../src/config'
import { ManifestValidationError, ObjectsDeployError, SettingsDeployError } from '../../src/client/errors'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'

describe('client validation', () => {
  let changes: Change[]

  const mockValidate = jest.fn()
  const client = {
    isSuiteAppConfigured: () => true,
    validate: mockValidate,
  } as unknown as NetsuiteClient

  const mockFiltersRunner: () => Required<Filter> = () => ({
    onFetch: jest.fn(),
    preDeploy: jest.fn(),
  }) as unknown as Required<Filter>

  beforeEach(() => {
    jest.clearAllMocks()
    changes = [
      toChange({
        after: new InstanceElement(
          'instanceName',
          workflowType().type,
          { [SCRIPT_ID]: 'object_name', manifestTest: '[scriptid=some_scriptid]' }
        ),
      }), toChange({
        after: new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotations: {
            manifestTest: '[scriptid=ref_in_custom_record_type]',
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
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[1]).elemID,
      message: 'SDF Objects Validation Error',
      severity: 'Error',
    })
  })
  it('should have SDF Objects Validation Error for customRecordType field', async () => {
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
    const fieldChanges = changes.filter(isObjectTypeChange).map(getChangeData).map(type => toChange({
      after: new Field(type, 'some_field', BuiltinTypes.STRING, { [SCRIPT_ID]: 'some_field' }),
    }))
    const changeErrors = await clientValidation(
      fieldChanges,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(fieldChanges[0]).elemID,
      message: 'SDF Objects Validation Error',
      severity: 'Error',
    })
  })
  it('should have SDF Objects Validation Error - in other language', async () => {
    const detailedMessage = `Une erreur s'est produite lors de la validation de l'objet personnalis.. (object_name)
Details: The object field daterange is missing.
Details: The object field kpi must not be OPENJOBS.
Details: The object field periodrange is missing.
Details: The object field compareperiodrange is missing.
Details: The object field defaultgeneraltype must not be ENTITY_ENTITY_NAME.
Details: The object field type must not be 449.
File: ~/Objects/object_name.xml`
    const fullErrorMessage = `
*** ERREUR ***
La validation a .chou..

${detailedMessage}`

    mockValidate.mockReturnValue([
      new ObjectsDeployError(fullErrorMessage, new Set(['object_name'])),
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'SDF Objects Validation Error',
      severity: 'Error',
    })
  })
  it('should have SDF Manifest Validation Error and remove the element causing it', async () => {
    const detailedMessage = `Validation of account settings failed.
    
    An error occurred during account settings validation.
    Details: The manifest contains a dependency on some_scriptid object, but it is not in the account.`
    mockValidate.mockReturnValue([new ManifestValidationError(detailedMessage, ['some_scriptid'])])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage: `This element depends on the following missing elements: (some_scriptid).
The missing dependencies might be locked elements in the source environment which do not exist in the target environment. Moreover, the dependencies might be part of a 3rd party bundle or SuiteApp.
If so, please make sure that all the bundles from the source account are installed and updated in the target account.`,
      elemID: getChangeData(changes[0]).elemID,
      message: 'This element depends on missing elements',
      severity: 'Error',
    })
  })
  it('should have SDF Manifest Validation Error on field', async () => {
    mockValidate.mockReturnValue([new ManifestValidationError('', ['ref_in_custom_record_type'])])
    const fieldChanges = changes.filter(isObjectTypeChange).flatMap(change => [
      change,
      toChange({
        after: new Field(
          getChangeData(change),
          'some_field',
          BuiltinTypes.STRING,
          { [SCRIPT_ID]: 'some_field' }
        ),
      }),
    ])
    const changeErrors = await clientValidation(
      fieldChanges,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors.map(changeErr => changeErr.elemID.getFullName())).toEqual([
      'netsuite.customrecord1',
      'netsuite.customrecord1.field.some_field',
    ])
  })
  it('should have general Validation Error', async () => {
    const detailedMessage = 'some error'
    mockValidate.mockReturnValue([new Error(detailedMessage)])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      detailedMessage,
      elemID: getChangeData(changes[0]).elemID,
      message: 'Validation Error on SDF - create or update',
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
