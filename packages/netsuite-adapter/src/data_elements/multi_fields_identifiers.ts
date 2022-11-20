/*
*                      Copyright 2022 Salto Labs Ltd.
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
  values: Values,
  type: ObjectType
): string => {
  if (!(type.elemID.name in TYPE_TO_ID_FIELD_PATHS)) {
    return values[TYPE_TO_IDENTIFIER[type.elemID.name]]
  }

  return TYPE_TO_ID_FIELD_PATHS[type.elemID.name]
    .map(fieldPath => _.get(values, fieldPath))
    .filter(value => value !== undefined)
    .join('_')
}

const getFullIdentifier = (
  values: Values,
  type: ObjectType,
  internalIdToValues: Record<string, Values>
): string => {
  const currentInstanceId = getIdentifierWithoutParent(values, type)
  if (values.parent === undefined) {
    return currentInstanceId
  }

  const parent = internalIdToValues[
    getDataInstanceId(values.parent.attributes.internalId, type.elemID.name)
  ]
  if (parent === undefined) {
    log.warn(`Could not find parent with id ${values.parent.attributes.internalId} of instance with id ${values.attributes.internalId} of type ${type.elemID.getFullName()}`)
    return `${values.parent.attributes.internalId}_${currentInstanceId}`
  }

  return `${getFullIdentifier(parent, type, internalIdToValues)}_${currentInstanceId}`
}

export const addIdentifierToValues = (
  valuesList: { type: ObjectType; values: Values }[],
): void => {
  const valuesListWithIdentifier = valuesList.filter(
    ({ type }) => type.fields[IDENTIFIER_FIELD] !== undefined
  )

  const internalIdToValues = Object.fromEntries(
    valuesListWithIdentifier
      .map(({ type, values }) => [
        getDataInstanceId(values.attributes.internalId, type.elemID.name),
        values,
      ])
  )


  const identifiers = valuesListWithIdentifier.map(({ values, type }) =>
    getFullIdentifier(values, type, internalIdToValues))

  // We first get all the identifiers and then set it in valuesListWithIdentifier
  // because `getFullIdentifier` uses values to generate the id and editing before
  // generating all the identifiers can cause duplication in the identifier parts
  valuesListWithIdentifier.forEach(({ values }, i) => {
    values[IDENTIFIER_FIELD] = identifiers[i]
  })
}
