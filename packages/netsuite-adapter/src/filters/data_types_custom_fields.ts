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
import { BuiltinTypes, Field, InstanceElement, isInstanceElement, isObjectType, ListType, ObjectType, ReferenceExpression, TypeElement } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { file } from '../types/file_cabinet_types'
import { FilterCreator } from '../filter'
import { INTERNAL_ID_TO_TYPES } from '../data_elements/types'
import { getFieldInstanceTypes } from '../data_elements/custom_fields'
import { isDataObjectType } from '../types'
import { SCRIPT_ID } from '../constants'
// eslint-disable-next-line camelcase
import { generic_customfield_fieldtypeValue } from '../autogen/types/enums'

const log = logger(module)

// eslint-disable-next-line camelcase
type CustomFieldPrimitiveType = Exclude<generic_customfield_fieldtypeValue, 'SELECT' | 'MULTISELECT'>

const CUSTOM_FIELD_TYPE_TO_SALTO_TYPE: Record<CustomFieldPrimitiveType, TypeElement> = {
  CHECKBOX: BuiltinTypes.BOOLEAN,
  CLOBTEXT: BuiltinTypes.STRING,
  CURRENCY: BuiltinTypes.NUMBER,
  DATE: BuiltinTypes.STRING,
  DATETIMETZ: BuiltinTypes.STRING,
  EMAIL: BuiltinTypes.STRING,
  FLOAT: BuiltinTypes.NUMBER,
  HELP: BuiltinTypes.STRING,
  IMAGE: file,
  DOCUMENT: file,
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

const SELECT_TYPES = ['MULTISELECT', 'SELECT']
export const CUSTOM_FIELD_PREFIX = 'custom_'

const getFieldType = (
  fieldInstance: InstanceElement,
  nameToType: Record<string, ObjectType>
): { fieldType: TypeElement; selectTypeIdAnnotation?: string } => {
  if (SELECT_TYPES.includes(fieldInstance.value.fieldtype)) {
    const types = fieldInstance.value.selectrecordtype in INTERNAL_ID_TO_TYPES
      ? INTERNAL_ID_TO_TYPES[fieldInstance.value.selectrecordtype].map(name => nameToType[name])
      : undefined

    // This can be unknown in two cases: the selectrecordtype points to a type we do not support,
    // or it points to a type that is represented by many sub types,
    // e.g., item which is represented by InventoryItem, AssemblyItem, etc..
    const fieldType = types !== undefined && types.length === 1 ? types[0] : BuiltinTypes.UNKNOWN

    const selectTypeIdAnnotation = fieldType.elemID.isEqual(BuiltinTypes.UNKNOWN.elemID)
      ? fieldInstance.value.selectrecordtype
      : undefined

    if (fieldInstance.value.fieldtype === 'MULTISELECT') {
      return { fieldType: new ListType(fieldType), selectTypeIdAnnotation }
    }
    return { fieldType, selectTypeIdAnnotation }
  }

  const fieldType = CUSTOM_FIELD_TYPE_TO_SALTO_TYPE[
    // eslint-disable-next-line camelcase
    fieldInstance.value.fieldtype as CustomFieldPrimitiveType
  ]
    ?? BuiltinTypes.UNKNOWN
  if (fieldType === undefined) {
    log.warn(`Did not find the type for ${fieldInstance.value.fieldtype} of instance ${fieldInstance.elemID.getFullName()}`)
    return { fieldType: BuiltinTypes.UNKNOWN }
  }
  return { fieldType }
}

const addFieldToType = (
  type: ObjectType,
  fieldInstance: InstanceElement,
  nameToType: Record<string, ObjectType>,
): void => {
  const fieldName = `${CUSTOM_FIELD_PREFIX}${fieldInstance.value.scriptid}`

  const { fieldType, selectTypeIdAnnotation } = getFieldType(fieldInstance, nameToType)

  type.fields[fieldName] = new Field(
    type,
    fieldName,
    fieldType,
    {
      // eslint-disable-next-line camelcase
      field_instance: new ReferenceExpression(fieldInstance.elemID.createNestedID(SCRIPT_ID)),
      // eslint-disable-next-line camelcase
      select_type_id: selectTypeIdAnnotation,
    }
  )
}

const filterCreator: FilterCreator = ({ isPartial, elementsSourceIndex }) => ({
  onFetch: async elements => {
    const dataTypes = elements
      .filter(isObjectType)
      .filter(isDataObjectType)

    const nameToType = _.keyBy(dataTypes, e => e.elemID.name)

    if (isPartial) {
      const fetchedIds = new Set(elements
        .filter(isInstanceElement)
        .map(instance => instance.elemID.getFullName()))

      Object.entries((await elementsSourceIndex.getIndexes()).customFieldsIndex)
        .filter(([type]) => type in nameToType)
        .forEach(([type, fields]) => {
          fields
            .filter(field => !fetchedIds.has(field.elemID.getFullName()))
            .forEach(field => addFieldToType(nameToType[type], field, nameToType))
        })
    }

    const instances = elements.filter(isInstanceElement)
    instances
      .forEach(fieldInstance => {
        getFieldInstanceTypes(fieldInstance)
          .map(typeName => nameToType[typeName])
          .filter(values.isDefined)
          .forEach(type => {
            addFieldToType(type, fieldInstance, nameToType)
          })
      })
  },
})

export default filterCreator
