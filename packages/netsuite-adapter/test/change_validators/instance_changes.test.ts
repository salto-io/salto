/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import instanceChangesValidator from '../../src/change_validators/instance_changes'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { mockChangeValidatorParams } from '../utils'

describe('customization type change validator', () => {
  it('should have change error if custom type SCRIPT_ID has been modified', async () => {
    const after = entitycustomfieldType().type
    after.fields[SCRIPT_ID].annotate({ dummyKey: 'dummyValue' })
    const changeErrors = await instanceChangesValidator(
      [toChange({ before: entitycustomfieldType().type, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(after.elemID)
  })
  it('should not have change error if custom record type SCRIPT_ID has been modified', async () => {
    const before = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    const after = before.clone()
    after.annotate({ dummyKey: 'dummyValue' })
    expect(await instanceChangesValidator([toChange({ before, after })], mockChangeValidatorParams())).toHaveLength(0)
  })
})
