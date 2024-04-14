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
import { fieldConfigurationItemDescriptionLengthValidator } from '../../../src/change_validators/field_configuration/field_configuration_item_description_length'
import { 
  JIRA, 
  FIELD_CONFIGURATION_TYPE_NAME, 
  FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH, 
  FIELD_CONFIGURATION_ITEM_TYPE_NAME
} from '../../../src/constants'

describe('fieldConfigurationItemDescriptionLengthValidator', () => {
  let fieldConfigurationType: ObjectType
  let fieldConfigurationInstance: InstanceElement
  let fieldConfigurationItemType: ObjectType
  let fieldConfigurationItemInstance: InstanceElement

  beforeEach(() => {
    fieldConfigurationType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME) })
    fieldConfigurationItemType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME) })

    fieldConfigurationInstance = new InstanceElement('instance', fieldConfigurationType, {
      fields: {
        item1: {
          description: 'item1 description'
        },
        item2: {
          description: 'item2 description'
        }
      },
    })

    fieldConfigurationItemInstance = new InstanceElement('instance', fieldConfigurationItemType, {
      description: 'item description',
      id: { elemID: new ElemID(JIRA, 'item') },
    })
  })

  it.each([0, 1, Math.floor(FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH / 2), FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH])('Should succeed because item description length inside FieldConfiguration is lower than maximum.', async (descriptionLength) => {
    const afterInstance = fieldConfigurationInstance.clone()
    afterInstance.value.fields.item1.description = '*'.repeat(descriptionLength)
    expect(
      await fieldConfigurationItemDescriptionLengthValidator([
        toChange({
          before: fieldConfigurationInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])
  })
  
  it('Should return an error because description length of items inside FieldConfiguration exceeds maximum.', async () => {
    const afterInstance = fieldConfigurationInstance.clone()
    afterInstance.value.fields.item1.description = '*'.repeat(FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH + 1)
    const result = await fieldConfigurationItemDescriptionLengthValidator([
      toChange({
        before: fieldConfigurationInstance,
        after: afterInstance,
      }),
    ])
    expect(result).toHaveLength(1)
    expect(result).toEqual([
      {
        elemID: fieldConfigurationInstance.elemID,
        severity: 'Error',
        message: 'Description length exceeded maximum.',
        detailedMessage: `Exceeded maximum description length of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters for the following fields: ${['item1']}.`,
      },
    ])
  })


  // Tests FieldConfigurationItem type:
  it.each([0, 1, Math.floor(FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH / 2), FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH])('Should succeed because FieldConfigurationItem description length is lower than maximum.', async (descriptionLength) => {
    const afterInstance = fieldConfigurationItemInstance.clone()
    afterInstance.value.description = '*'.repeat(descriptionLength)
    expect(
      await fieldConfigurationItemDescriptionLengthValidator([
        toChange({
          before: fieldConfigurationItemInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])
  })
  
  it('Should return an error because FieldConfigurationItem description length exceeds maximum.', async () => {
    const afterInstance = fieldConfigurationItemInstance.clone()
    afterInstance.value.description = '*'.repeat(FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH + 1)
    const result = await fieldConfigurationItemDescriptionLengthValidator([
      toChange({
        before: fieldConfigurationItemInstance,
        after: afterInstance,
      }),
    ])
    expect(result).toHaveLength(1)
    expect(result).toEqual([
      {
        elemID: fieldConfigurationItemInstance.elemID,
        severity: 'Error',
        message: 'Description length exceeded maximum.',
        detailedMessage: `Description length (${afterInstance.value.description.length}) of field configuration item (${afterInstance.value.id.elemID.getFullName()}) exceeded the allowed maximum of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
      },
    ])
  })
})
