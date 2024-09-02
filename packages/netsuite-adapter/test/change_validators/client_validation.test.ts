/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { Filter } from '../../src/filter'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import clientValidation from '../../src/change_validators/client_validation'
import NetsuiteClient from '../../src/client/client'
import { AdditionalDependencies } from '../../src/config/types'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { fileType } from '../../src/types/file_cabinet_types'
import { SDF_CREATE_OR_UPDATE_GROUP_ID } from '../../src/group_changes'

describe('client validation', () => {
  let changes: Change[]

  const mockValidate = jest.fn()
  const client = {
    isSuiteAppConfigured: () => true,
    validate: mockValidate,
  } as unknown as NetsuiteClient

  const mockFiltersRunner: () => Required<Filter> = () =>
    ({
      onFetch: jest.fn(),
      preDeploy: jest.fn(),
    }) as unknown as Required<Filter>

  beforeEach(() => {
    jest.clearAllMocks()
    changes = [
      toChange({
        after: new InstanceElement('customworkflow1', workflowType().type, { [SCRIPT_ID]: 'customworkflow1' }),
      }),
      toChange({
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
    mockValidate.mockResolvedValue([])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should return error on a specific change', async () => {
    mockValidate.mockResolvedValue([
      {
        elemID: getChangeData(changes[0]).elemID,
        message: 'Some Error',
        severity: 'Error',
      },
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toEqual([
      {
        elemID: getChangeData(changes[0]).elemID,
        message: 'SDF validation error',
        detailedMessage: 'Some Error',
        severity: 'Error',
      },
    ])
  })
  it('should return errors on all changes', async () => {
    mockValidate.mockResolvedValue([
      {
        message: 'Some Error',
        severity: 'Error',
      },
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(changes.length)
    expect(changeErrors).toEqual(
      expect.arrayContaining(
        changes.map(change => ({
          elemID: getChangeData(change).elemID,
          message: 'SDF validation error',
          detailedMessage: 'Some Error',
          severity: 'Error',
        })),
      ),
    )
  })
  it('should ignore error on a specific element that is not in the changes list', async () => {
    mockValidate.mockResolvedValue([
      {
        elemID: new ElemID(NETSUITE, 'type', 'instance', 'additional'),
        message: 'Some Error',
        severity: 'Error',
      },
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should return missing dependencies errors', async () => {
    mockValidate.mockResolvedValue([
      {
        elemID: getChangeData(changes[0]).elemID,
        message: 'Details: The manifest contains a dependency on customlist1',
        severity: 'Error',
      },
      {
        elemID: getChangeData(changes[0]).elemID,
        message: 'Details: The manifest contains a dependency on customworkflow2.workflowstate1',
        severity: 'Error',
      },
      {
        elemID: getChangeData(changes[1]).elemID,
        message: "D.tails: Le manifeste comporte une d.pendance sur l'objet customlist1",
        severity: 'Error',
      },
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual(
      expect.arrayContaining([
        {
          elemID: getChangeData(changes[0]).elemID,
          severity: 'Error',
          message: 'This element depends on missing elements',
          detailedMessage: expect.stringContaining(
            'Cannot deploy elements because of missing dependencies: customlist1, customworkflow2.workflowstate1.',
          ),
        },
        {
          elemID: getChangeData(changes[1]).elemID,
          severity: 'Error',
          message: 'This element depends on missing elements',
          detailedMessage: expect.stringContaining(
            'Cannot deploy elements because of missing dependencies: customlist1.',
          ),
        },
      ]),
    )
  })
  it('should return missing features errors', async () => {
    mockValidate.mockResolvedValue([
      {
        elemID: getChangeData(changes[0]).elemID,
        message:
          'Details: To install this SuiteCloud project, the ADVANCEDREVENUERECOGNITION(Advanced Revenue Management (Essentials)) feature must be enabled in the account.',
        severity: 'Error',
      },
      {
        elemID: getChangeData(changes[0]).elemID,
        message:
          'Details: To install this SuiteCloud project, the MULTIBOOK(Adjustment Only Books) feature must be enabled in the account.',
        severity: 'Error',
      },
      {
        elemID: getChangeData(changes[1]).elemID,
        message:
          'Details: To install this SuiteCloud project, the MULTIBOOK(Adjustment Only Books) feature must be enabled in the account.',
        severity: 'Error',
      },
    ])
    const changeErrors = await clientValidation(
      changes,
      client,
      {} as unknown as AdditionalDependencies,
      mockFiltersRunner,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual(
      expect.arrayContaining([
        {
          elemID: getChangeData(changes[0]).elemID,
          severity: 'Error',
          message: 'This element requires features that are not enabled in the account',
          detailedMessage: expect.stringContaining(
            'Cannot deploy element because of required features that are not enabled in the target account: ADVANCEDREVENUERECOGNITION(Advanced Revenue Management (Essentials)), MULTIBOOK(Adjustment Only Books).',
          ),
        },
        {
          elemID: getChangeData(changes[1]).elemID,
          severity: 'Error',
          message: 'This element requires features that are not enabled in the account',
          detailedMessage: expect.stringContaining(
            'Cannot deploy element because of required features that are not enabled in the target account: MULTIBOOK(Adjustment Only Books).',
          ),
        },
      ]),
    )
  })
  describe('validate file cabinet instances', () => {
    let fileChange: Change<InstanceElement>
    beforeEach(() => {
      fileChange = toChange({
        after: new InstanceElement('file', fileType(), {
          path: '/SuiteScripts/a.txt',
        }),
      })
    })
    it('should call validate with SDF groupId and additional file cabinet change', async () => {
      const changesToValidate = changes.concat(fileChange)
      await clientValidation(changesToValidate, client, {} as unknown as AdditionalDependencies, mockFiltersRunner)
      expect(mockValidate).toHaveBeenCalledWith(
        expect.arrayContaining(changesToValidate),
        SDF_CREATE_OR_UPDATE_GROUP_ID,
        {},
      )
    })
    it('should call validate with SDF groupId and file cabinet change that in SDF group', async () => {
      getChangeData(fileChange).value.generateurltimestamp = true
      await clientValidation([fileChange], client, {} as unknown as AdditionalDependencies, mockFiltersRunner)
      expect(mockValidate).toHaveBeenCalledWith([fileChange], SDF_CREATE_OR_UPDATE_GROUP_ID, {})
    })
    it('should call validate with SDF groupID when the is no suiteapp configured', async () => {
      const noSuiteAppClient = {
        isSuiteAppConfigured: () => false,
        validate: mockValidate,
      } as unknown as NetsuiteClient
      await clientValidation([fileChange], noSuiteAppClient, {} as unknown as AdditionalDependencies, mockFiltersRunner)
      expect(mockValidate).toHaveBeenCalledWith([fileChange], SDF_CREATE_OR_UPDATE_GROUP_ID, {})
    })
    it('should not call validate when there are only file cabinet instances that are in suiteapp group', async () => {
      await clientValidation([fileChange], client, {} as unknown as AdditionalDependencies, mockFiltersRunner)
      expect(mockValidate).not.toHaveBeenCalled()
    })
    it('should not return change error on file cabinet instance that is in another real change group', async () => {
      mockValidate.mockResolvedValue([
        {
          elemID: getChangeData(fileChange).elemID,
          message: 'File Error',
          severity: 'Error',
        },
        {
          elemID: getChangeData(changes[0]).elemID,
          message: 'SDF Change Error',
          severity: 'Error',
        },
        {
          message: 'General Error',
          severity: 'Error',
        },
      ])
      const changesToValidate = changes.concat(fileChange)
      const changeErrors = await clientValidation(
        changesToValidate,
        client,
        {} as unknown as AdditionalDependencies,
        mockFiltersRunner,
      )
      expect(changeErrors).toHaveLength(changes.length + 1)
      expect(changeErrors).toEqual(
        expect.arrayContaining(
          changes
            .map(change => ({
              elemID: getChangeData(change).elemID,
              message: 'SDF validation error',
              detailedMessage: 'General Error',
              severity: 'Error',
            }))
            .concat({
              elemID: getChangeData(changes[0]).elemID,
              message: 'SDF validation error',
              detailedMessage: 'SDF Change Error',
              severity: 'Error',
            }),
        ),
      )
    })
  })
})
