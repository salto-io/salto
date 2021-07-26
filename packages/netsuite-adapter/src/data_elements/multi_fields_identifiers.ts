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
import { BuiltinTypes, Field, ObjectType, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getDataInstanceId } from '../elements_source_index/elements_source_index'
import { IDENTIFIER_FIELD, TYPE_TO_IDENTIFIER, TYPE_TO_ID_FIELD_PATHS } from './types'

const log = logger(module)


export const addIdentifierToType = (type: ObjectType): void => {
  if (!(type.elemID.name in TYPE_TO_ID_FIELD_PATHS) && type.fields.parent === undefined) {
    return
  }

  type.fields[IDENTIFIER_FIELD] = new Field(type, IDENTIFIER_FIELD, BuiltinTypes.SERVICE_ID)
}

const getIdentifierWithoutParent = (
  record: Values,
  type: ObjectType
): string => {
  if (!(type.elemID.name in TYPE_TO_ID_FIELD_PATHS)) {
    return record[TYPE_TO_IDENTIFIER[type.elemID.name]]
  }

  return TYPE_TO_ID_FIELD_PATHS[type.elemID.name]
    .map(fieldPath => _.get(record, fieldPath))
    .filter(values.isDefined)
    .join('_')
}

const getFullIdentifier = (
  record: Values,
  type: ObjectType,
  internalIdToExternalId: Record<string, Values>
): string => {
  const currentInstanceId = getIdentifierWithoutParent(record, type)
  if (record.parent === undefined) {
    return currentInstanceId
  }

  const parent = internalIdToExternalId[
    getDataInstanceId(record.parent.attributes.internalId, type)
  ]
  if (parent === undefined) {
    log.warn(`Could not find parent with id ${record.parent.attributes.internalId} of instance with id ${record.attributes.internalId} of type ${type.elemID.getFullName()}`)
    return `${record.parent.attributes.internalId}_${currentInstanceId}`
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return `${getFullIdentifier(parent, type, internalIdToExternalId)}_${currentInstanceId}`
}

export const addIdentifierToValues = (
  valuesList: { type: ObjectType; record: Values }[],
): void => {
  const valuesListWithIdentifier = valuesList.filter(
    ({ type }) => type.fields[IDENTIFIER_FIELD] !== undefined
  )

  const internalIdToExternalId = _(valuesListWithIdentifier)
    .keyBy(({ type, record }) => getDataInstanceId(record.attributes.internalId, type))
    .mapValues(({ record }) => record)
    .value()


  const identifiers = valuesListWithIdentifier.map(({ record, type }) =>
    getFullIdentifier(record, type, internalIdToExternalId))

  // We first get all the identifiers and then set it in valuesListWithIdentifier
  // because `getFullIdentifier` uses record to generate the id and editing before
  // generating all the records can cause duplication in the identifier parts
  valuesListWithIdentifier.forEach(({ record }, i) => {
    record[IDENTIFIER_FIELD] = identifiers[i]
  })
}
