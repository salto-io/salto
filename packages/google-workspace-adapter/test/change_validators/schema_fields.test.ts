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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ADAPTER_NAME, SCHEMA_TYPE_NAME } from '../../src/constants'
import { schemaFieldsValidator } from '../../src/change_validators'

describe('schemaFieldsValidator', () => {
  const schemaInstance = new InstanceElement(
    'testSchema',
    new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SCHEMA_TYPE_NAME) }),
    {
      schemaName: 'uri',
      fields: {
        a: {
          fieldType: 'INT64',
          fieldName: 'wori',
          multiValued: true,
        },
      },
    },
  )
  it('should return a Error if trying to change a field Type', async () => {
    const cloneSchema = schemaInstance.clone()
    cloneSchema.value.fields.a.fieldType = 'STRING'
    const errors = await schemaFieldsValidator([toChange({ before: schemaInstance, after: cloneSchema })])
    expect(errors).toEqual([
      {
        elemID: schemaInstance.elemID,
        severity: 'Error',
        message: 'Can not change field type or change existing field to be single valued',
        detailedMessage: 'Can not change field type or change existing field to be multiValue',
      },
    ])
  })
  it('should return a Error if trying to change a field to be single valued', async () => {
    const cloneSchema = schemaInstance.clone()
    cloneSchema.value.fields.a.multiValued = false
    const errors = await schemaFieldsValidator([toChange({ before: schemaInstance, after: cloneSchema })])
    expect(errors).toEqual([
      {
        elemID: schemaInstance.elemID,
        severity: 'Error',
        message: 'Can not change field type or change existing field to be single valued',
        detailedMessage: 'Can not change field type or change existing field to be multiValue',
      },
    ])
  })
  it('should not return a Error if trying to change a field to be multi valued', async () => {
    const cloneSchema = schemaInstance.clone()
    cloneSchema.value.fields.a.multiValued = false
    const errors = await schemaFieldsValidator([toChange({ before: cloneSchema, after: schemaInstance })])
    expect(errors).toEqual([])
  })
})
