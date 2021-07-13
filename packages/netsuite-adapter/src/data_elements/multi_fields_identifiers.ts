/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, Field, ObjectType } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'

// This is used for constructing a unique identifier for data types
// field using multiple other fields
export const TYPE_TO_ID_FIELD_PATHS: Record<string, string[][]> = {
  AccountingPeriod: [['periodName'], ['fiscalCalendar', 'name']],
}

export const IDENTIFIER_FIELD = 'identifier'

export const addIdentifierToType = (type: ObjectType): void => {
  if (!(type.elemID.name in TYPE_TO_ID_FIELD_PATHS)) {
    return
  }

  type.fields[IDENTIFIER_FIELD] = new Field(type, IDENTIFIER_FIELD, BuiltinTypes.SERVICE_ID)
}

export const addIdentifierToValues = (
  record: Record<string, unknown>,
  type: ObjectType
): void => {
  if (!(type.elemID.name in TYPE_TO_ID_FIELD_PATHS)) {
    return
  }

  record.identifier = TYPE_TO_ID_FIELD_PATHS[type.elemID.name]
    .map(fieldPath => _.get(record, fieldPath))
    .filter(values.isDefined)
    .join('_')
}
