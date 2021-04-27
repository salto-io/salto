
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
import { FieldDefinition, Field, CORE_ANNOTATIONS, ObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FieldToHideType } from '../config/transformation'
import { SUBTYPES_PATH, TYPES_PATH } from './constants'
import { getSubtypes } from './subtypes'

const log = logger(module)

/**
 * Annotate fields with _hidden_value=true if they match the specified configuration.
 */
export const hideFields = (
  fieldsToHide: FieldToHideType[],
  typeFields: Record<string, FieldDefinition | Field>,
  typeName: string,
): void => {
  fieldsToHide.forEach(({ fieldName, fieldType }) => {
    const field = typeFields[fieldName]
    if (field === undefined) {
      log.warn('field %s.%s not found, cannot hide it', typeName, fieldName)
      return
    }
    if (fieldType === undefined || fieldType === field.refType.elemID.name) {
      log.debug('Hiding values for field %s.%s', typeName, fieldName)
      field.annotations = {
        ...(field.annotations ?? {}),
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      }
    }
  })
}


export const filterTypes = (
  adapterName: string,
  allTypes: ObjectType[],
  typesToFilter: string[]
): ObjectType[] => {
  const nameToType = _.keyBy(allTypes, type => type.elemID.name)

  const relevantTypes = typesToFilter.map(name => {
    const type = nameToType[name]
    if (type === undefined) {
      log.warn(`Data type '${name}' of adapter ${adapterName} does not exist`)
    }
    return type
  }).filter(values.isDefined)

  relevantTypes.forEach(t => { t.path = [adapterName, TYPES_PATH, t.elemID.name] })
  const subtypes = getSubtypes(relevantTypes)
  subtypes.forEach(t => { t.path = [adapterName, TYPES_PATH, SUBTYPES_PATH, t.elemID.name] })

  return [...relevantTypes, ...subtypes]
}
