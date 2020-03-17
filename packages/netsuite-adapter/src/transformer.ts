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
  Field, InstanceElement, isObjectType, ObjectType, TypeElement, Value, Values,
} from '@salto-io/adapter-api'
import { Record } from 'node-suitetalk'
import {
  bpCase, transformValues,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import {
  ATTRIBUTES, INTERNAL_ID, IS_ATTRIBUTE, METADATA_TYPE, NETSUITE, RECORDS_PATH, RECORD_REF,
} from './constants'
import { NetsuiteRecord, NetsuiteReference } from './client/client'
import { recordRefElemID, Types } from './types'

const { makeArray } = collections.array


const fromNetsuiteRecord = (record: Values, type: ObjectType): Values => {
  // Netsuite Records are returned with ATTRIBUTES object that we should embed into its parent
  // { "$attributes": { "internalId": "1" }, "label": "A" } => { "internalId": "1" , "label": "A" }
  const flattenAttributes = (values: Values): Values => {
    const flattenAttributesCustomizer = (val: Values): Values | undefined => {
      if (_.has(val, ATTRIBUTES)) {
        const withInnerAttributes = _.merge({}, val, val[ATTRIBUTES])
        const withFlattenAttributes = _.omit(withInnerAttributes, ATTRIBUTES)
        return _.cloneDeepWith(withFlattenAttributes, flattenAttributesCustomizer)
      }
      return undefined
    }
    return _.cloneDeepWith(values, flattenAttributesCustomizer)
  }
  return transformValues({ values: flattenAttributes(record), type }) || {}
}

export const createInstanceElement = (record: Values, type: ObjectType): InstanceElement => {
  const values = fromNetsuiteRecord(record, type)
  const instanceName = bpCase(values.label)
  return new InstanceElement(instanceName, type, values,
    [NETSUITE, RECORDS_PATH, type.elemID.name, instanceName])
}

export const internalId = (instance: InstanceElement): string =>
  instance.value[INTERNAL_ID]

const metadataType = (instance: InstanceElement): string =>
  instance.type.annotations[METADATA_TYPE]

const isAttribute = (field: Field): boolean =>
  field.annotations[IS_ATTRIBUTE] === true

const isListField = (fieldType: TypeElement): fieldType is ObjectType =>
  isObjectType(fieldType) && Object.values(fieldType.fields).length === 1
    && Object.values(fieldType.fields)[0].isList

const toLineField = (lineFieldDefinition: Field, lineValues: Values): Record.Fields.Line => {
  const lineField = new Record.Fields.Line(lineFieldDefinition.type.elemID.name,
    lineFieldDefinition.name)
  lineField.bodyFieldList = Object.entries(lineValues)
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
    .map(([name, value]) => toNetsuiteField(name, value,
      (lineFieldDefinition.type as ObjectType).fields[name].type))
  return lineField
}

const toListField = (name: string, value: Value, fieldType: ObjectType): Record.Fields.List => {
  const lineFieldDefinition = Object.values(fieldType.fields)[0]
  const listField = new Record.Fields.List(fieldType.elemID.name, name)
  listField.list = makeArray(value[lineFieldDefinition.name])
    .map(lineValue => toLineField(lineFieldDefinition, lineValue))
  return listField
}

const toNetsuiteField = (name: string, value: Value, fieldType: TypeElement):
  Record.Fields.Field => {
  if (fieldType.elemID.isEqual(recordRefElemID)) {
    const field = new Record.Fields.RecordRef(name)
    _.assign(field, value)
    return field
  }
  if (isListField(fieldType)) {
    return toListField(name, value, fieldType)
  }
  return new Record.Fields.PrimitiveField(name, value)
}

const toNetsuiteFields = (instance: InstanceElement): Record.Fields.Field[] =>
  Object.entries(instance.value)
    .filter(([name, _value]) => !isAttribute(instance.type.fields[name]))
    .map(([name, value]) => {
      const fieldType = instance.type.fields[name].type
      return toNetsuiteField(name, value, fieldType)
    })

const setAttributes = (record: NetsuiteRecord, instance: InstanceElement): void => {
  _.assign(record,
    _.pickBy(instance.value, (_value, name) => isAttribute(instance.type.fields[name])))
}

export const toNetsuiteRecord = (instance: InstanceElement): NetsuiteRecord => {
  const record = new Record.Types.Record(Types.getFamilyTypeName(instance.type),
    instance.type.elemID.name)
  setAttributes(record, instance)
  record.bodyFieldList = toNetsuiteFields(instance)
  return record
}

export const toNetsuiteReference = (instance: InstanceElement): NetsuiteReference =>
  new Record.Types.Reference(RECORD_REF, metadataType(instance), internalId(instance))
