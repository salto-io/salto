/* eslint-disable header/header */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  isObjectType, Field, Values, TypeElement, isType, ElemID, Element,
  TypeMap,
  BuiltinTypes,
  PrimitiveType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { SALESFORCE } from '../constants'
import { FilterCreator } from '../filter'
import { id } from './utils'
import missingFieldsData from './missing_fields.json'

const log = logger(module)

type AnnotationRestrictionData = {
  _enforceValue?: boolean
}

type AnnotationData = {
  _values?: string[]
  _restrictions?: AnnotationRestrictionData
}

type RawFieldData = {
  name: string
  type: string
  annotations?: AnnotationData
  isList?: boolean
}

type RawMissingFieldData = {
  id: string
  fields: RawFieldData[]
}

type FieldData = {
  name: string
  type: ElemID | PrimitiveType
  annotations?: AnnotationData
  isList?: boolean
}

type MissingFieldData = {
  id: ElemID | PrimitiveType
  fields: FieldData[]
}

type MissingField = {
  name: string
  type: TypeElement | ElemID
  annotations?: Values
  isList?: boolean
}

const generateType = (typeName: string): PrimitiveType | ElemID => {
  if (Object.keys(BuiltinTypes).includes(typeName)) {
    return BuiltinTypes[typeName]
  }
  return new ElemID(SALESFORCE, typeName)
}

const generateField = (fieldData: RawFieldData): FieldData => ({
  name: fieldData.name,
  type: generateType(fieldData.type),
  annotations: fieldData.annotations,
  isList: fieldData.isList,
})

const generateFields = (fieldsData: RawFieldData[]): FieldData[] =>
  fieldsData.map(fieldData => generateField(fieldData))

const generateId = (idName: string): ElemID => new ElemID(SALESFORCE, idName)

const generateAllMissingFields = (
  rawMissingFieldsData: RawMissingFieldData[]
): MissingFieldData[] =>
  rawMissingFieldsData.map(rawMissingFieldData => ({
    id: generateId(rawMissingFieldData.id),
    fields: generateFields(rawMissingFieldData.fields),
  }))

export const missingFields = generateAllMissingFields(
  missingFieldsData as unknown as RawMissingFieldData[]
)

export const makeFilter = (
  allMissingFields: Record<string, MissingField[]>
): FilterCreator => () => ({
  onFetch: async function onFetch(elements) {
    // We need a mapping of all the types so we can replace type names with the correct types
    const typeMap: TypeMap = _(elements)
      .filter(isType)
      .map(t => [id(t), t])
      .fromPairs()
      .value()

    const addMissingField = (elem: Element) => (f: MissingField): Field | undefined => {
      const type = isType(f.type) ? f.type : typeMap[f.type.getFullName()]
      if (type === undefined) {
        log.warn('Failed to find type %s, omitting field %s', (f.type as ElemID).getFullName(), f.name)
        return undefined
      }
      return new Field(elem.elemID, f.name, type, f.annotations)
    }

    // Add missing fields to types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToAdd = allMissingFields[id(elem)]
      if (fieldsToAdd !== undefined) {
        _.assign(elem.fields, _(fieldsToAdd)
          .map(addMissingField(elem))
          .reject(_.isUndefined)
          .map((f: Field) => [f.name, f])
          .fromPairs()
          .value())
      }
    })
  },
})

export default makeFilter(
  _(missingFields)
    .map(missingField => [(missingField.id as ElemID).getFullName(), missingField.fields])
    .fromPairs()
    .value(),
)
