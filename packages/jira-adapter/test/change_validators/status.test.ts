/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { statusValidator } from '../../src/change_validators/status'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('statusValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let invalidStatusCategory: InstanceElement
  let validStatusCategory: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) })
    instance = new InstanceElement('instance', type, {
      name: 'status',
    })

    invalidStatusCategory = new InstanceElement(
      'No_Category@s',
      new ObjectType({ elemID: new ElemID(JIRA, 'StatusCategory') }),
      {
        name: 'No Category',
      },
    )

    validStatusCategory = new InstanceElement('Done', new ObjectType({ elemID: new ElemID(JIRA, 'StatusCategory') }), {
      name: 'Done',
    })
  })
  it('should return if status category is No_Category', async () => {
    instance.value.statusCategory = new ReferenceExpression(invalidStatusCategory.elemID, invalidStatusCategory)
    expect(
      await statusValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'statusCategory can not have No_Category value',
        detailedMessage:
          'This status has an invalid statusCategory No_Category@s. statusCategory should be one of the following: Done, In_Progress or To_Do.',
      },
    ])
  })
  it('should not throw on unresolved reference', async () => {
    instance.value.statusCategory = new ReferenceExpression(invalidStatusCategory.elemID, undefined)
    await expect(statusValidator([toChange({ after: instance })])).resolves.not.toThrow()
  })

  it('should not return an error if status category is not No_Category', async () => {
    instance.value.statusCategory = new ReferenceExpression(validStatusCategory.elemID, validStatusCategory)
    expect(
      await statusValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
})
