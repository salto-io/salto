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
import _ from 'lodash'
import { getChangeData, isAdditionChange, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterWith } from '../filter'
import { getCustomField } from './data_types_custom_fields'
import { isCustomRecordType } from '../types'
import { INDEX, SCRIPT_ID, SOAP, SOURCE } from '../constants'
import { CUSTOM_FIELDS, CUSTOM_FIELDS_LIST } from '../custom_records/custom_record_type'

const { makeArray } = collections.array

const toCustomRecordTypeReference = (type: ObjectType): string => `[${SCRIPT_ID}=${type.annotations[SCRIPT_ID]}]`

const addFieldsToType = (
  type: ObjectType,
  nameToType: Record<string, ObjectType>,
  customRecordTypes: Record<string, ObjectType>,
): void => {
  makeArray(type.annotations[CUSTOM_FIELDS]?.[CUSTOM_FIELDS_LIST]).forEach((customField, index) => {
    const field = getCustomField({
      type,
      customField,
      nameToType,
      customRecordTypes,
    })
    field.annotations = { ...customField, [INDEX]: index }
    type.fields[field.name] = field
  })
}

const removeCustomFieldsAnnotation = (type: ObjectType): void => {
  delete type.annotationRefTypes[CUSTOM_FIELDS]
  delete type.annotations[CUSTOM_FIELDS]
}

const removeInstancesAnnotation = (type: ObjectType): void => {
  delete type.annotationRefTypes.instances
  delete type.annotations.instances
}

const filterCreator = (): FilterWith<'onFetch' | 'onDeploy'> => ({
  onFetch: async elements => {
    const types = elements.filter(isObjectType)
    const customRecordTypeObjects = types.filter(isCustomRecordType)
    const nameToType = _.keyBy(types, type => type.elemID.name)
    const customRecordTypesMap = _.keyBy(customRecordTypeObjects, toCustomRecordTypeReference)
    const typeNameToInstances = _.groupBy(
      elements.filter(isInstanceElement),
      inst => inst.elemID.typeName
    )
    customRecordTypeObjects.forEach(type => {
      addFieldsToType(type, nameToType, customRecordTypesMap)
      removeCustomFieldsAnnotation(type)
      if (type.elemID.name in typeNameToInstances) {
        removeInstancesAnnotation(type)
      }
    })
  },
  onDeploy: async changes => {
    changes
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .forEach(type => {
        type.annotate({ [SOURCE]: SOAP })
      })
  },
})

export default filterCreator
