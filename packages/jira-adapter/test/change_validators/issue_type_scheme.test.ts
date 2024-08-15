/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement, Change, getChangeData } from '@salto-io/adapter-api'
import { issueTypeSchemeValidator } from '../../src/change_validators/issue_type_scheme'
import { ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME, JIRA } from '../../src/constants'

describe('issueTypeSchemeValidator', () => {
  let issueTypeSchemeChange: Change
  let issueTypeChange: Change

  beforeEach(() => {
    const issueTypeSchemeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_SCHEMA_NAME) })
    const issueType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) })

    issueTypeSchemeChange = toChange({
      before: new InstanceElement('instance', issueTypeSchemeType, {
        isDefault: true,
        issueTypeIds: ['1', '2', '3'],
      }),

      after: new InstanceElement('instance', issueTypeSchemeType, {
        isDefault: true,
        issueTypeIds: ['1', '2'],
      }),
    })

    issueTypeChange = toChange({
      before: new InstanceElement('instance', issueType, {
        id: '3',
      }),
    })
  })

  it('should return an error if an issue type was removed from the list without being deleted', async () => {
    expect(await issueTypeSchemeValidator([issueTypeSchemeChange])).toEqual([
      {
        elemID: getChangeData(issueTypeSchemeChange).elemID,
        severity: 'Error',
        message: 'Cannot remove issue types from default issue type scheme',
        detailedMessage: 'Removing issue types from the default issue type scheme is not supported',
      },
    ])
  })

  it('should not return an error if an issue type was removed from the list and was deleted', async () => {
    expect(await issueTypeSchemeValidator([issueTypeSchemeChange, issueTypeChange])).toEqual([])
  })
})
