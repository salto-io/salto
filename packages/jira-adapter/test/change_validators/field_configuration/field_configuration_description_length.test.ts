/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { fieldConfigurationDescriptionLengthValidator } from '../../../src/change_validators/field_configuration/field_configuration_description_length'
import { JIRA, FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH, FIELD_CONFIGURATION_TYPE_NAME } from '../../../src/constants'

describe('fieldConfigurationDescriptionLengthValidator', () => {
  let fieldConfigurationObjectType: ObjectType
  let fieldConfigurationInstance: InstanceElement
  const BOUNDARY_VALUES = [
    0, // Lower bound
    1, // Lower + 1
    Math.floor(FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH / 2), // Average case
    FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH - 1, // Upper bound - 1
    FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH, // Upper bound
  ]
  beforeEach(() => {
    fieldConfigurationObjectType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME) })

    fieldConfigurationInstance = new InstanceElement('instance', fieldConfigurationObjectType, {
      fields: {
        description: 'configuration description',
        item: {
          description: 'item description',
        },
      },
    })
  })

  it.each(BOUNDARY_VALUES)(
    'Should succeed because field configuration description length is lower than maximum.',
    async descriptionLength => {
      const afterInstance = fieldConfigurationInstance.clone()
      afterInstance.value.description = '*'.repeat(descriptionLength)
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
    afterInstance.value.description = '*'.repeat(FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH + 1)

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
