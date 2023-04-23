/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ObjectType, ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import { OKTA, GROUP_SCHEMA_TYPE_NAME } from '../../src/constants'
import { groupSchemaModifyBaseValidator } from '../../src/change_validators/group_schema_modify_base_fields'

describe('groupSchemaModifyBaseValidator', () => {
  const groupSchemaType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_SCHEMA_TYPE_NAME) })
  const groupSchemaBeforeInstance = new InstanceElement(
    'defualtGroupSchema',
    groupSchemaType,
    {
      definitions: {
        base: {
          properties: {
            field1: { title: 'field1' },
            field2: { title: 'field2' },
          },
        },
      },
    },
  )
  const groupSchemaRemovedFieldInstance = new InstanceElement(
    'defualtGroupSchema',
    groupSchemaType,
    {
      definitions: {
        base: {
          properties: {
            field1: { title: 'field1' },
          },
        },
      },
    },
  )
  const groupSchemaModifiedFieldInstance = new InstanceElement(
    'defualtGroupSchema',
    groupSchemaType,
    {
      definitions: {
        base: {
          properties: {
            field1: { title: 'field1' },
            field2: { title: 'field2Changed' },
          },
        },
      },
    },
  )
  it('should return errors for changing base field', async () => {
    const changes = [toChange({ before: groupSchemaBeforeInstance.clone(), after: groupSchemaModifiedFieldInstance }),
      toChange({ before: groupSchemaBeforeInstance.clone(), after: groupSchemaRemovedFieldInstance })]
    const changeErrors = await groupSchemaModifyBaseValidator(changes)
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([{
      elemID: groupSchemaModifiedFieldInstance.elemID,
      severity: 'Error',
      message: `Cannot change base properties of ${GROUP_SCHEMA_TYPE_NAME}`,
      detailedMessage: `It is possible to modify the custom properties section of the ${GROUP_SCHEMA_TYPE_NAME} instance.`,
    },
    {
      elemID: groupSchemaRemovedFieldInstance.elemID,
      severity: 'Error',
      message: `Cannot change base properties of ${GROUP_SCHEMA_TYPE_NAME}`,
      detailedMessage: `It is possible to modify the custom properties section of the ${GROUP_SCHEMA_TYPE_NAME} instance.`,
    }])
  })
  it('should not return errors for changing custom field', async () => {
    const groupSchemaWithCustomFields = new InstanceElement(
      'defualtGroupSchema',
      groupSchemaType,
      {
        definitions: {
          base: {
            properties: {
              field1: { title: 'field1' },
              field2: { title: 'field2' },
            },
          },
          custom: {
            properties: {
              additionalProperties: {
                field1: {},
              },
            },
          },
        },
      },
    )
    const changes = [toChange({ before: groupSchemaBeforeInstance.clone(), after: groupSchemaWithCustomFields })]
    const changeErrors = await groupSchemaModifyBaseValidator(changes)
    expect(changeErrors).toHaveLength(0)
  })
})
