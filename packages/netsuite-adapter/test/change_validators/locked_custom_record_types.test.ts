/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import lockedCustomRecordTypesValidator from '../../src/change_validators/locked_custom_record_types'
import { CUSTOM_RECORD_TYPE, IS_LOCKED, METADATA_TYPE, NETSUITE } from '../../src/constants'
import { mockChangeValidatorParams } from '../utils'

describe('remove sdf object change validator', () => {
  const customRecordType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord1'),
    annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE },
  })
  const lockedCustomRecordType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord1_locked'),
    annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [IS_LOCKED]: true },
  })

  it('should have a change error for added locked custom record type', async () => {
    const changeErrors = await lockedCustomRecordTypesValidator(
      [toChange({ after: lockedCustomRecordType })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: lockedCustomRecordType.elemID,
      severity: 'Error',
      message: 'Cannot add, modify, or remove locked custom record types',
      detailedMessage:
        'Cannot create, modify or remove locked custom record types.' +
        ' To manage locked objects, please manually install or update their bundle in the target account.',
    })
  })

  it('should have a change error for removed locked custom record type', async () => {
    const changeErrors = await lockedCustomRecordTypesValidator(
      [toChange({ before: lockedCustomRecordType })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: lockedCustomRecordType.elemID,
      severity: 'Error',
      message: 'Cannot add, modify, or remove locked custom record types',
      detailedMessage:
        'Cannot create, modify or remove locked custom record types.' +
        ' To manage locked objects, please manually install or update their bundle in the target account.',
    })
  })

  it('should have a change error for modified locked custom record type', async () => {
    const afterLockedCustomRecordType = lockedCustomRecordType.clone()
    delete afterLockedCustomRecordType.annotations[IS_LOCKED]
    const changeErrors = await lockedCustomRecordTypesValidator(
      [toChange({ before: lockedCustomRecordType, after: afterLockedCustomRecordType })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: lockedCustomRecordType.elemID,
      severity: 'Error',
      message: 'Cannot add, modify, or remove locked custom record types',
      detailedMessage:
        'Cannot create, modify or remove locked custom record types.' +
        ' To manage locked objects, please manually install or update their bundle in the target account.',
    })
  })

  it('should not have a change error for non locked custom record type', async () => {
    const changeErrors = await lockedCustomRecordTypesValidator(
      [toChange({ after: customRecordType })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })
})
