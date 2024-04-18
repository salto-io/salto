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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { fieldConfigurationItemDescriptionLengthValidator } from '../../../src/change_validators/field_configuration/field_configuration_item_description_length'
import {
  JIRA,
  FIELD_CONFIGURATION_TYPE_NAME,
  FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH,
  FIELD_CONFIGURATION_ITEM_TYPE_NAME,
} from '../../../src/constants'

describe('fieldConfigurationItemDescriptionLengthValidator non split configuration', () => {
  const fieldConfigurationObjectType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME) })
  const fieldConfigurationItemObjectType = new ObjectType({
    elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
  })
  const INITIAL_DESCRIPTION = 'initial description'
  const EMPTY_DESCRIPTION = '*'.repeat(0)
  const SHORT_DESCRIPTION = '*'.repeat(1)
  const AVERAGE_DESCRIPTION = '*'.repeat(Math.floor(FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH / 2))
  const MAX_DESCRIPTION = '*'.repeat(FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH)
  const LONG_DESCRIPTION = '*'.repeat(FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH + 1)

  it('Should succeed because regular mode item description length inside FieldConfiguration is lower than maximum.', async () => {
    const beforeInstance = new InstanceElement('RegularModeFieldConfiguration', fieldConfigurationObjectType, {
      fields: {
        empty_description: {
          description: INITIAL_DESCRIPTION,
        },
        short_description: {
          description: INITIAL_DESCRIPTION,
        },
        average_description: {
          description: INITIAL_DESCRIPTION,
        },
        max_description: {
          description: INITIAL_DESCRIPTION,
        },
      },
    })
    const afterInstance = beforeInstance.clone()
    afterInstance.value.fields.empty_description.description = EMPTY_DESCRIPTION
    afterInstance.value.fields.short_description.description = SHORT_DESCRIPTION
    afterInstance.value.fields.average_description.description = AVERAGE_DESCRIPTION
    afterInstance.value.fields.max_description.description = MAX_DESCRIPTION

    expect(
      await fieldConfigurationItemDescriptionLengthValidator([
        toChange({
          before: beforeInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])
  })

  it('Should succeed because split mode item description length inside FieldConfiguration is lower than maximum.', async () => {
    const fieldConfigurationInstance = new InstanceElement('SplitModeFieldConfiguration', fieldConfigurationObjectType)
    const beforeInstances = [
      new InstanceElement('SplitModeFieldConfigurationItem-EmptyDescription', fieldConfigurationItemObjectType, {
        description: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
      new InstanceElement('SplitModeFieldConfigurationItem-ShortDescription', fieldConfigurationItemObjectType, {
        description: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
      new InstanceElement('SplitModeFieldConfigurationItem-AverageDescription', fieldConfigurationItemObjectType, {
        description: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
      new InstanceElement('SplitModeFieldConfigurationItem-MaxDescription', fieldConfigurationItemObjectType, {
        description: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
    ]
    const afterInstances = beforeInstances.map(instance => instance.clone())
    afterInstances[0].value.description = EMPTY_DESCRIPTION
    afterInstances[1].value.description = SHORT_DESCRIPTION
    afterInstances[2].value.description = AVERAGE_DESCRIPTION
    afterInstances[3].value.description = MAX_DESCRIPTION
    expect(
      await fieldConfigurationItemDescriptionLengthValidator(
        beforeInstances.map((beforeInstance, index) =>
          toChange({ before: beforeInstance, after: afterInstances[index] }),
        ),
      ),
    ).toEqual([])
  })

  it('Should return an error for each item in regular mode FieldConfiguration with description length exceeding maximum', async () => {
    const beforeInstance = new InstanceElement('RegularModeFieldConfiguration', fieldConfigurationObjectType, {
      fields: {
        valid_description: {
          description: INITIAL_DESCRIPTION,
        },
        invalid_description1: {
          description: INITIAL_DESCRIPTION,
        },
        invalid_description2: {
          description: INITIAL_DESCRIPTION,
        },
      },
    })
    const afterInstance = beforeInstance.clone()
    afterInstance.value.fields.valid_description.description = AVERAGE_DESCRIPTION
    afterInstance.value.fields.invalid_description1.description = LONG_DESCRIPTION
    afterInstance.value.fields.invalid_description2.description = LONG_DESCRIPTION
    const result = await fieldConfigurationItemDescriptionLengthValidator([
      toChange({
        before: beforeInstance,
        after: afterInstance,
      }),
    ])
    expect(result).toHaveLength(2)
    expect(result).toEqual([
      {
        elemID: afterInstance.elemID.createNestedID('fields', 'invalid_description1'),
        severity: 'Error',
        message: 'Description length exceeded maximum.',
        detailedMessage: `Description length (${LONG_DESCRIPTION.length}) of field configuration item exceeded the allowed maximum of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
      },
      {
        elemID: afterInstance.elemID.createNestedID('fields', 'invalid_description2'),
        severity: 'Error',
        message: 'Description length exceeded maximum.',
        detailedMessage: `Description length (${LONG_DESCRIPTION.length}) of field configuration item exceeded the allowed maximum of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
      },
    ])
  })

  it('Should return an error for each item in split mode FieldConfiguration with description length exceeding maximum', async () => {
    const fieldConfigurationInstance = new InstanceElement('SplitModeFieldConfiguration', fieldConfigurationObjectType)
    const beforeInstances = [
      new InstanceElement('SplitModeFieldConfigurationItem-AverageDescription', fieldConfigurationItemObjectType, {
        description: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
      new InstanceElement('SplitModeFieldConfigurationItem-LongDescription1', fieldConfigurationItemObjectType, {
        description: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
      new InstanceElement('SplitModeFieldConfigurationItem-LongDescription2', fieldConfigurationItemObjectType, {
        description: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
    ]
    const afterInstances = beforeInstances.map(instance => instance.clone())
    afterInstances[0].value.description = AVERAGE_DESCRIPTION
    afterInstances[1].value.description = LONG_DESCRIPTION
    afterInstances[2].value.description = LONG_DESCRIPTION
    const result = await fieldConfigurationItemDescriptionLengthValidator(
      beforeInstances.map((beforeInstance, index) =>
        toChange({ before: beforeInstance, after: afterInstances[index] }),
      ),
    )
    expect(result).toHaveLength(2)
    expect(result).toEqual([
      {
        elemID: afterInstances[1].elemID,
        severity: 'Error',
        message: 'Description length exceeded maximum.',
        detailedMessage: `Description length (${LONG_DESCRIPTION.length}) of field configuration item exceeded the allowed maximum of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
      },
      {
        elemID: afterInstances[2].elemID,
        severity: 'Error',
        message: 'Description length exceeded maximum.',
        detailedMessage: `Description length (${LONG_DESCRIPTION.length}) of field configuration item exceeded the allowed maximum of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
      },
    ])
  })

  it('Should succeed because there is no description in the item in regular mode for field configuration', async () => {
    const beforeInstance = new InstanceElement('RegularModeFieldConfiguration', fieldConfigurationObjectType, {
      fields: {
        long_string_not_description: {
          some_string: INITIAL_DESCRIPTION,
        },
        number_field_not_description: {
          some_field: 0,
        },
      },
    })
    const afterInstance = beforeInstance.clone()
    afterInstance.value.fields.long_string_not_description.some_string = LONG_DESCRIPTION
    afterInstance.value.fields.number_field_not_description.some_field = 1
    const result = await fieldConfigurationItemDescriptionLengthValidator([
      toChange({ before: beforeInstance, after: afterInstance }),
    ])
    expect(result).toEqual([])
  })

  it('Should succeed because there is no description in the item in split mode for field configuration', async () => {
    const fieldConfigurationInstance = new InstanceElement('SplitModeFieldConfiguration', fieldConfigurationObjectType)
    const beforeInstances = [
      new InstanceElement('SplitModeFieldConfigurationItem-AverageDescription', fieldConfigurationItemObjectType, {
        some_string: INITIAL_DESCRIPTION,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
      new InstanceElement('SplitModeFieldConfigurationItem-LongDescription1', fieldConfigurationItemObjectType, {
        some_field: 0,
        id: new ReferenceExpression(fieldConfigurationInstance.elemID),
      }),
    ]
    const afterInstances = beforeInstances.map(instance => instance.clone())
    afterInstances[0].value.some_string = LONG_DESCRIPTION
    afterInstances[1].value.some_field = 1
    const result = await fieldConfigurationItemDescriptionLengthValidator(
      beforeInstances.map((beforeInstance, index) =>
        toChange({ before: beforeInstance, after: afterInstances[index] }),
      ),
    )
    expect(result).toEqual([])
  })
})
