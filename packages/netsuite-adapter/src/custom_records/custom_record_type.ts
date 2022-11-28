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
import { promises } from '@salto-io/lowerdash'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, TypeRefMap } from '@salto-io/adapter-api'
import { CUSTOM_RECORDS_PATH, CUSTOM_RECORD_TYPE, INDEX, INTERNAL_ID, METADATA_TYPE, NETSUITE, SCRIPT_ID, SOAP, SOURCE } from '../constants'
import { customrecordtypeType } from '../autogen/types/standard_types/customrecordtype'
import { isCustomFieldName } from '../types'

const { mapValuesAsync } = promises.object

export const CUSTOM_FIELDS = 'customrecordcustomfields'
export const CUSTOM_FIELDS_LIST = 'customrecordcustomfield'

export const toAnnotationRefTypes = (type: ObjectType): Promise<TypeRefMap> =>
  mapValuesAsync(type.fields, async field => {
    const fieldType = await field.getType()
    if (field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]) {
      if (fieldType.elemID.isEqual(BuiltinTypes.BOOLEAN.elemID)) {
        return BuiltinTypes.HIDDEN_BOOLEAN
      }
      if (fieldType.elemID.isEqual(BuiltinTypes.STRING.elemID)) {
        return BuiltinTypes.HIDDEN_STRING
      }
    }
    return fieldType
  })

export const createCustomRecordTypes = async (
  customRecordTypeInstances: InstanceElement[],
  customRecordType: ObjectType
): Promise<ObjectType[]> => {
  const annotationRefsOrTypes = await toAnnotationRefTypes(customRecordType)
  return customRecordTypeInstances.map(instance => new ObjectType({
    elemID: new ElemID(NETSUITE, instance.value[SCRIPT_ID]),
    fields: {
      [SCRIPT_ID]: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: { [CORE_ANNOTATIONS.REQUIRED]: true },
      },
      [INTERNAL_ID]: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
    annotationRefsOrTypes: {
      ...annotationRefsOrTypes,
      source: BuiltinTypes.HIDDEN_STRING,
    },
    annotations: {
      ...instance.value,
      [SOURCE]: SOAP,
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
    },
    path: [NETSUITE, CUSTOM_RECORDS_PATH, instance.value[SCRIPT_ID]],
  }))
}

export const toCustomRecordTypeInstance = (
  element: ObjectType
): InstanceElement => new InstanceElement(
  element.elemID.name,
  customrecordtypeType().type,
  {
    ..._.omit(element.annotations, [SOURCE, METADATA_TYPE]),
    [CUSTOM_FIELDS]: {
      [CUSTOM_FIELDS_LIST]: _(Object.values(element.fields))
        .filter(field => isCustomFieldName(field.name))
        .map(field => field.annotations)
        .sortBy(INDEX)
        .map(item => _.omit(item, INDEX))
        .value(),
    },
  }
)
