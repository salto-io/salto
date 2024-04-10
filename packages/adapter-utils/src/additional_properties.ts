/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Field,
  Element,
  ObjectType,
  Value,
  ReferenceExpression,
  isReferenceExpression,
  TypeReference,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'

const log = logger(module)
type AdditionalPropertiesAnnotation = {
  refType: ReferenceExpression
  annotations?: Record<string, Value>
}

export const setAdditionalPropertiesAnnotation = <T extends Element>(
  type: T,
  value?: false | AdditionalPropertiesAnnotation,
): T => {
  type.annotate({ [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: value })
  return type
}

const isAdditionalPropertiesAnnotation = (value: Value): value is AdditionalPropertiesAnnotation =>
  (value?.annotations === undefined || _.isPlainObject(value?.annotations)) &&
  isReferenceExpression(value?.refType) &&
  value.refType.elemID.idType === 'type'

export const extractAdditionalPropertiesField = (objType: ObjectType, name: string): Field | undefined => {
  const additionalProperties = objType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]
  if (additionalProperties === undefined) {
    return new Field(objType, name, BuiltinTypes.UNKNOWN)
  }
  if (isAdditionalPropertiesAnnotation(additionalProperties)) {
    const { elemID, value: type } = additionalProperties.refType
    if (elemID.idType !== 'type') {
      log.warn('Additional properties annotations refType reference is not a type')
      return undefined
    }
    return new Field(objType, name, new TypeReference(elemID, type), additionalProperties.annotations)
  }
  // case additionalProperties = false
  return undefined
}
