/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { fieldConfigurationDescriptionLengthValidator } from '../../../src/change_validators/field_configuration/field_configuration_description_length'
import { JIRA, FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH, FIELD_CONFIGURATION_TYPE_NAME } from '../../../src/constants'

describe('fieldConfigurationDescriptionLengthValidator', () => {
  let fieldConfigurationObjectType: ObjectType
  let fieldConfigurationInstance: InstanceElement
  const INITIAL_DESCRIPTION = 'initial description'
  const EMPTY_DESCRIPTION = '*'.repeat(0)
  const UNDEFINED_DESCRIPTION = undefined
  const SHORT_DESCRIPTION = '*'.repeat(1)
  const AVERAGE_DESCRIPTION = '*'.repeat(Math.floor(FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH / 2))
  const MAX_DESCRIPTION = '*'.repeat(FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH)
  const LONG_DESCRIPTION = '*'.repeat(FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH + 1)

  beforeEach(() => {
    fieldConfigurationObjectType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME) })

    fieldConfigurationInstance = new InstanceElement('instance', fieldConfigurationObjectType, {
      fields: {
        description: 'configuration description',
        item: {
          description: INITIAL_DESCRIPTION,
        },
      },
    })
  })

  it.each([EMPTY_DESCRIPTION, SHORT_DESCRIPTION, AVERAGE_DESCRIPTION, MAX_DESCRIPTION, UNDEFINED_DESCRIPTION])(
    'Should succeed because field configuration description length is lower than maximum.',
    async updatedDescription => {
      const afterInstance = fieldConfigurationInstance.clone()
      afterInstance.value.description = updatedDescription
      expect(
        await fieldConfigurationDescriptionLengthValidator([
          toChange({
            before: fieldConfigurationInstance,
            after: afterInstance,
          }),
        ]),
      ).toEqual([])
    },
  )

  it('Should return an error because field configuration description length exceeds maximum.', async () => {
    const afterInstance = fieldConfigurationInstance.clone()
    afterInstance.value.description = LONG_DESCRIPTION

    expect(
      await fieldConfigurationDescriptionLengthValidator([
        toChange({
          before: fieldConfigurationInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: fieldConfigurationInstance.elemID,
        severity: 'Error',
        message: 'Field configuration description length exceeded maximum.',
        detailedMessage: `Field configuration description length (${afterInstance.value.description.length}) exceeded the allowed maximum of ${FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH} characters.`,
      },
    ])
  })
})
