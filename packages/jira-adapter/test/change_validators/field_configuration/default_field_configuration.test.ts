/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { defaultFieldConfigurationValidator } from '../../../src/change_validators/field_configuration/default_field_configuration'
import { JIRA } from '../../../src/constants'

describe('defaultFieldConfigurationValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'FieldConfiguration') })
    instance = new InstanceElement('instance', type, {
      isDefault: true,
      fields: {
        item: {
          isHidden: true,
          isRequired: false,
        },
      },
    })
  })

  it('should return an error if changed', async () => {
    const afterInstance = instance.clone()
    afterInstance.value.name = 'new name'

    expect(
      await defaultFieldConfigurationValidator([
        toChange({
          before: instance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Modifying the default field configuration is not supported',
        detailedMessage: 'Modifying the default field configuration is not supported.',
      },
    ])
  })
  it('should not return an error if the change is in the default field configuration item', async () => {
    const afterInstance = instance.clone()
    afterInstance.value.fields.item.isRequired = true

    expect(
      await defaultFieldConfigurationValidator([
        toChange({
          before: instance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])
  })

  it('should not return an error if not default', async () => {
    delete instance.value.isDefault
    const afterInstance = instance.clone()
    afterInstance.value.name = 'new name'

    expect(
      await defaultFieldConfigurationValidator([
        toChange({
          before: instance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])
  })
})
