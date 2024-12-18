/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, InstanceElement, Change } from '@salto-io/adapter-api'
import { EXACT_TEXT_SEARCHER_KEY, fieldValidator, TEXT_FIELD_TYPE } from '../../src/change_validators/field'
import { FIELD_TYPE } from '../../src/constants'
import { createEmptyType } from '../utils'

describe('fieldValidator', () => {
  let validInstance: InstanceElement
  let invalidAfterInstance: InstanceElement
  let changes: Change[]

  beforeEach(() => {
    validInstance = new InstanceElement('instance', createEmptyType(FIELD_TYPE), {
      type: TEXT_FIELD_TYPE,
      searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:textsearcher',
    })
    invalidAfterInstance = validInstance.clone()
    invalidAfterInstance.value.searcherKey = EXACT_TEXT_SEARCHER_KEY
    changes = [
      toChange({
        after: validInstance,
      }),
      toChange({
        after: invalidAfterInstance,
      }),
      toChange({
        before: validInstance,
        after: invalidAfterInstance,
      }),
    ]
  })

  it('Should return an error for adding/modifying an instance with an invalid searcherKey for this type', async () => {
    expect(await fieldValidator(changes)).toEqual([
      {
        elemID: invalidAfterInstance.elemID,
        severity: 'Error',
        message: 'SearcherKey is invalid for the field type',
        detailedMessage:
          'This field was created using JIT and cannot be deployed. To resolve this issue, edit the NaCl file, and in the searchKey field, replace "exacttextsearcher" with "textsearcher".',
      },
      {
        elemID: invalidAfterInstance.elemID,
        severity: 'Error',
        message: 'SearcherKey is invalid for the field type',
        detailedMessage:
          'This field was created using JIT and cannot be deployed. To resolve this issue, edit the NaCl file, and in the searchKey field, replace "exacttextsearcher" with "textsearcher".',
      },
    ])
  })
})
