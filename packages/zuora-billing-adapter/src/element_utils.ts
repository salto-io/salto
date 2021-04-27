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
import {
  isInstanceElement, Element, isObjectType, isField, ObjectType, Field, InstanceElement,
} from '@salto-io/adapter-api'
import {
  CUSTOM_FIELD, CUSTOM_OBJECT, ZUORA_CUSTOM_SUFFIX, METADATA_TYPE, STANDARD_OBJECT,
} from './constants'

export const metadataType = (element: Element): string | undefined => {
  if (isInstanceElement(element)) {
    return metadataType(element.type)
  }
  if (isField(element)) {
    // We expect to reach to this place only with fields of CustomObject
    return CUSTOM_FIELD
  }
  return element.annotations[METADATA_TYPE]
}

export const isObjectDef = (element: Element): element is ObjectType => (
  isObjectType(element)
  && [CUSTOM_OBJECT, STANDARD_OBJECT].includes(metadataType(element) || 'unknown')
)

export const isCustomField = (field: Field): boolean => (
  // using the suffix as well because custom fields of standard objects don't always have origin
  field.annotations.origin === 'custom' || field.name.endsWith(ZUORA_CUSTOM_SUFFIX)
)

export const isInstanceOfType = (
  element: Element,
  typeNames: string[],
): element is InstanceElement => (
  isInstanceElement(element)
  && typeNames.includes(element.type.elemID.name)
)
