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
import { BuiltinTypes, Field, isInstanceElement, isObjectType, ListType, ObjectType, ReferenceExpression, TypeElement } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { INTERNAL_ID_TO_TYPES } from '../data_elements/types'
import { getFieldInstanceTypes } from '../data_elements/custom_fields'
import { FILE, SCRIPT_ID } from '../constants'
// eslint-disable-next-line camelcase
import { generic_customfield_fieldtypeValue } from '../autogen/types/enums'
import { toCustomFieldName } from '../types'

const log = logger(module)

type CustomFieldReferenceType = 'SELECT' | 'MULTISELECT'
type CustomFieldPrimitiveType =
  // eslint-disable-next-line camelcase
  Exclude<generic_customfield_fieldtypeValue, CustomFieldReferenceType>

type PrimitiveCustomField = {
  scriptid: string
  fieldtype: CustomFieldPrimitiveType
}
type ReferenceCustomField = {
  scriptid: string
  fieldtype: CustomFieldReferenceType
  selectrecordtype: string
}
type CustomField = PrimitiveCustomField | ReferenceCustomField

const isReferenceCustomField = (
  customField: CustomField
): customField is ReferenceCustomField =>
  customField.fieldtype === 'SELECT' || customField.fieldtype === 'MULTISELECT'

const getFieldType = (
  fieldName: string,
  customField: CustomField,
  nameToType: Record<string, ObjectType>,
  customRecordTypes: Record<string, ObjectType>
): {
  fieldType: TypeElement
  selectTypeIdAnnotation?: string
} => {
  const CUSTOM_FIELD_TYPE_TO_SALTO_TYPE: Record<CustomFieldPrimitiveType, TypeElement> = {
    CHECKBOX: BuiltinTypes.BOOLEAN,
    CLOBTEXT: BuiltinTypes.STRING,
    CURRENCY: BuiltinTypes.NUMBER,
    DATE: BuiltinTypes.STRING,
    DATETIMETZ: BuiltinTypes.STRING,
    EMAIL: BuiltinTypes.STRING,
    FLOAT: BuiltinTypes.NUMBER,
    HELP: BuiltinTypes.STRING,
    IMAGE: nameToType[FILE],
    DOCUMENT: nameToType[FILE],
    INLINEHTML: BuiltinTypes.STRING,
    INTEGER: BuiltinTypes.NUMBER,
    PASSWORD: BuiltinTypes.STRING,
    PERCENT: BuiltinTypes.NUMBER,
    PHONE: BuiltinTypes.STRING,
    RICHTEXT: BuiltinTypes.STRING,
    TEXT: BuiltinTypes.STRING,
    TEXTAREA: BuiltinTypes.STRING,
    TIMEOFDAY: BuiltinTypes.STRING,
    URL: BuiltinTypes.STRING,
  }

  if (isReferenceCustomField(customField)) {
    const customRecordType = customField.selectrecordtype in customRecordTypes
      ? customRecordTypes[customField.selectrecordtype]
      : undefined
    const types = customField.selectrecordtype in INTERNAL_ID_TO_TYPES
      ? INTERNAL_ID_TO_TYPES[customField.selectrecordtype]
        .filter(name => name in nameToType)
        .map(name => nameToType[name])
      : []

    // This can be unknown in two cases:
    // the selectrecordtype points to a type we do not support,
    // or it points to a type that is represented by many sub types,
    // e.g., item which is represented by InventoryItem, AssemblyItem, etc..
    const fieldType = customRecordType ?? (types.length === 1 ? types[0] : BuiltinTypes.UNKNOWN)

    const selectTypeIdAnnotation = fieldType.elemID.isEqual(BuiltinTypes.UNKNOWN.elemID)
      ? customField.selectrecordtype
      : undefined

    return customField.fieldtype === 'SELECT'
      ? { fieldType, selectTypeIdAnnotation }
      : { fieldType: new ListType(fieldType), selectTypeIdAnnotation }
  }

  const fieldType = CUSTOM_FIELD_TYPE_TO_SALTO_TYPE[customField.fieldtype]
  if (fieldType === undefined) {
    log.warn('Received unexpected fieldtype of field %s: %s', fieldName, customField.fieldtype)
    return { fieldType: BuiltinTypes.UNKNOWN }
  }
  return { fieldType }
}

export const getCustomField = ({
  type, customField, nameToType, customRecordTypes = {},
}: {
  type: ObjectType
  customField: CustomField
  nameToType: Record<string, ObjectType>
  customRecordTypes?: Record<string, ObjectType>
}): Field => {
  const fieldName = toCustomFieldName(customField.scriptid)
  const {
    fieldType,
    selectTypeIdAnnotation,
  } = getFieldType(fieldName, customField, nameToType, customRecordTypes)

  return new Field(type, fieldName, fieldType, {
    // eslint-disable-next-line camelcase
    select_type_id: selectTypeIdAnnotation,
  })
}

const filterCreator: FilterCreator = ({ isPartial, elementsSourceIndex }) => ({
  name: 'dataTypesCustomFields',
  onFetch: async elements => {
    const nameToType = _.keyBy(elements.filter(isObjectType), e => e.elemID.name)

    if (isPartial) {
      const fetchedIds = new Set(elements
        .filter(isInstanceElement)
        .map(instance => instance.elemID.getFullName()))

      Object.entries((await elementsSourceIndex.getIndexes()).customFieldsIndex)
        .filter(([type]) => type in nameToType)
        .forEach(([typeName, fields]) => {
          fields
            // We don't want to use fields from the elementSource that
            // were fetched from the service in the current fetch so we filter them out.
            // Fields that are fetched in the current fetch are added to
            // the type later in this function
            .filter(field => !fetchedIds.has(field.elemID.getFullName()))
            .forEach(fieldInstance => {
              const type = nameToType[typeName]
              const field = getCustomField({
                type,
                customField: fieldInstance.value as CustomField,
                nameToType,
              })
              field.annotate({
                // eslint-disable-next-line camelcase
                field_instance: new ReferenceExpression(
                  fieldInstance.elemID.createNestedID(SCRIPT_ID)
                ),
              })
              type.fields[field.elemID.name] = field
            })
        })
    }

    const instances = elements.filter(isInstanceElement)
    instances
      .forEach(fieldInstance => {
        getFieldInstanceTypes(fieldInstance)
          .map(typeName => nameToType[typeName])
          .filter(values.isDefined)
          .forEach(type => {
            const field = getCustomField({
              type,
              customField: fieldInstance.value as CustomField,
              nameToType,
            })
            field.annotate({
              // eslint-disable-next-line camelcase
              field_instance: new ReferenceExpression(
                fieldInstance.elemID.createNestedID(SCRIPT_ID)
              ),
            })
            type.fields[field.elemID.name] = field
          })
      })
  },
})

export default filterCreator
