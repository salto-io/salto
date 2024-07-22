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
import { ValueTypeField } from '@salto-io/jsforce-types'
import missingFieldsData from './missing_fields.json'

// The following types describe the data in missing_fields.json
type FullMissingFieldDefinition = {
  name: string
  type: string
  picklistValues?: string[]
}

type BooleanMissingFieldDefinition = {
  boolean: string[]
}

type MissingFieldDefinition =
  | FullMissingFieldDefinition
  | BooleanMissingFieldDefinition

export type MissingFieldsDataItem = {
  id: string
  fields: MissingFieldDefinition[]
}

const isBooleanRawFieldData = (
  fieldData: MissingFieldDefinition,
): fieldData is BooleanMissingFieldDefinition => 'boolean' in fieldData

const toValueTypeField = (
  fieldData: FullMissingFieldDefinition,
): ValueTypeField => ({
  name: fieldData.name,
  soapType: fieldData.type,
  valueRequired: false,
  isForeignKey: false,
  fields: [],
  foreignKeyDomain: '',
  isNameField: false,
  minOccurs: 0,
  picklistValues:
    fieldData.picklistValues !== undefined
      ? fieldData.picklistValues.map((value) => ({
          active: true,
          defaultValue: false,
          value,
        }))
      : [],
})

const getFieldsFromFieldData = (
  fieldData: MissingFieldDefinition,
): ValueTypeField[] =>
  isBooleanRawFieldData(fieldData)
    ? fieldData.boolean.map((name) =>
        toValueTypeField({ name, type: 'boolean' }),
      )
    : [toValueTypeField(fieldData)]

export const convertRawMissingFields = (
  missingFieldDefinitions: MissingFieldsDataItem[],
): Record<string, ValueTypeField[]> =>
  Object.fromEntries(
    missingFieldDefinitions.map(({ id, fields }) => [
      id,
      fields.flatMap(getFieldsFromFieldData),
    ]),
  )

export const defaultMissingFields = (): Record<string, ValueTypeField[]> =>
  convertRawMissingFields(
    missingFieldsData as unknown as MissingFieldsDataItem[],
  )
