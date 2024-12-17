/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { fieldValidator } from '../../src/change_validators/field'
import { JIRA } from '../../src/constants'

const EXACT_TEXT_SEARCHER_KEY = 'com.atlassian.jira.plugin.system.customfieldtypes:exacttextsearcher'
const TEXT_FIELD_TYPE = 'com.atlassian.jira.plugin.system.customfieldtypes:textfield'

describe('fieldValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let afterInstance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
    instance = new InstanceElement('instance', type, {
      type: TEXT_FIELD_TYPE,
      searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:textsearcher',
    })
    afterInstance = instance.clone()
    afterInstance.value.searcherKey = EXACT_TEXT_SEARCHER_KEY
  })

  it('should return error if created an instance with an invalid searcher key for this type', async () => {
    expect(
      await fieldValidator([
        toChange({
          after: afterInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'SearcherKey is invalid for the field type',
        detailedMessage: 'SearcherKey is invalid for the field type.',
      },
    ])
  })

  it('should return an error if changed to the exact text searcher key', async () => {
    expect(
      await fieldValidator([
        toChange({
          before: instance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'SearcherKey is invalid for the field type',
        detailedMessage: 'SearcherKey is invalid for the field type.',
      },
    ])
  })
})
