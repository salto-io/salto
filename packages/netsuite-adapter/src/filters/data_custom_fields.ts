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
import { file } from '../types/file_cabinet_types'
import { FilterCreator } from '../filter'
import { INTERNAL_ID_TO_TYPES } from '../data_elements/types'
import { getFieldInstanceTypes } from '../data_elements/custom_fields'
import { isDataObjectType } from '../types'

const CUSTOM_FIELD_TYPE_TO_SALTO_TYPE: Record<string, TypeElement> = {
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

const getFieldType = (
  fieldInstance: InstanceElement,
  nameToType: Record<string, ObjectType>
): { fieldType: TypeElement; selectTypeIdAnnotation: string | undefined } => {
  if (SELECT_TYPES.includes(fieldInstance.value.fieldtype)) {
    const types = fieldInstance.value.selectrecordtype in INTERNAL_ID_TO_TYPES
      ? INTERNAL_ID_TO_TYPES[fieldInstance.value.selectrecordtype].map(name => nameToType[name])
      : undefined

    const fieldType = types !== undefined && types.length === 1 ? types[0] : BuiltinTypes.UNKNOWN

    const selectTypeIdAnnotation = fieldType.elemID.isEqual(BuiltinTypes.UNKNOWN.elemID)
      ? fieldInstance.value.selectrecordtype
      : undefined

    if (fieldInstance.value.fieldtype === 'MULTISELECT') {
      return { fieldType: new ListType(fieldType), selectTypeIdAnnotation }
    }
    return { fieldType, selectTypeIdAnnotation }
  }

  const fieldType = CUSTOM_FIELD_TYPE_TO_SALTO_TYPE[fieldInstance.value.fieldtype]
    ?? BuiltinTypes.UNKNOWN
  return { fieldType, selectTypeIdAnnotation: undefined }
}

const addFieldToType = (
  type: ObjectType,
  fieldInstance: InstanceElement,
  nameToType: Record<string, ObjectType>,
): void => {
  const fieldName = fieldInstance.value.scriptid

  const { fieldType, selectTypeIdAnnotation } = getFieldType(fieldInstance, nameToType)

  type.fields[fieldName] = new Field(
    type,
    fieldName,
    fieldType,
    {
      // eslint-disable-next-line camelcase
      field_instance: new ReferenceExpression(fieldInstance.elemID),
      // eslint-disable-next-line camelcase
      select_type_id: selectTypeIdAnnotation,
    }
  )
}

const filterCreator: FilterCreator = ({ isPartial, elementsSourceIndex }) => ({
  onFetch: async elements => {
    const dataTypes = _(elements)
      .filter(isObjectType)
      .filter(isDataObjectType)
      .value()

    const nameToType = _.keyBy(dataTypes, e => e.elemID.name)

    const instances = elements.filter(isInstanceElement)
    _(instances)
      .forEach(fieldInstance => {
        _(getFieldInstanceTypes(fieldInstance))
          .map(typeName => nameToType[typeName])
          .filter(values.isDefined)
          .forEach(type => {
            addFieldToType(type, fieldInstance, nameToType)
          })
      })

    if (isPartial) {
      _((await elementsSourceIndex.getIndexes()).customFieldsIndex)
        .entries()
        .filter(([type]) => type in nameToType)
        .forEach(([type, fields]) => {
          fields.forEach(field => addFieldToType(nameToType[type], field, nameToType))
        })
    }
  },
})

export default filterCreator
