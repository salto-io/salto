/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'
import { systemFieldsValidator } from '../../src/change_validators/system_fields'
import { JIRA } from '../../src/constants'

describe('systemFieldsValidator', () => {
  const type = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })
  const systemFieldInstance = new InstanceElement('instance', type, { schema: {}, description: 'description' })
  it('should return an error if the field is a system field', async () => {
    expect(
      await systemFieldsValidator([
        toChange({
          after: systemFieldInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: systemFieldInstance.elemID,
        severity: 'Error',
        message: 'Can not deploy changes to a Jira system field',
        detailedMessage:
          'This is a built-in Jira system field, and can not be edited or deleted. Changes to this field will not be deployed.',
      },
    ])
  })

  it('should return an error when attempting to modify a system field', async () => {
    const modifiedSystemFieldInstance = new InstanceElement('instance', type, {
      schema: {},
      description: 'modified description',
    })
    expect(
      await systemFieldsValidator([
        toChange({
          before: systemFieldInstance,
          after: modifiedSystemFieldInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: systemFieldInstance.elemID,
        severity: 'Error',
        message: 'Can not deploy changes to a Jira system field',
        detailedMessage:
          'This is a built-in Jira system field, and can not be edited or deleted. Changes to this field will not be deployed.',
      },
    ])
  })

  it('should return an error when attempting to remove the schema field from a system field', async () => {
    const modifiedSystemFieldInstance = new InstanceElement('instance', type, { description: 'description' })
    expect(
      await systemFieldsValidator([
        toChange({
          before: systemFieldInstance,
          after: modifiedSystemFieldInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: systemFieldInstance.elemID,
        severity: 'Error',
        message: 'Can not deploy changes to a Jira system field',
        detailedMessage:
          'This is a built-in Jira system field, and can not be edited or deleted. Changes to this field will not be deployed.',
      },
    ])
  })

  it('should return an error when attempting to remove a system field', async () => {
    expect(
      await systemFieldsValidator([
        toChange({
          before: systemFieldInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: systemFieldInstance.elemID,
        severity: 'Error',
        message: 'Can not deploy changes to a Jira system field',
        detailedMessage:
          'This is a built-in Jira system field, and can not be edited or deleted. Changes to this field will not be deployed.',
      },
    ])
  })

  it('should not return an error if the field is not a system field', async () => {
    const notSystemFieldInstance = new InstanceElement('instance', type)
    expect(
      await systemFieldsValidator([
        toChange({
          after: notSystemFieldInstance,
        }),
      ]),
    ).toEqual([])
  })
})
