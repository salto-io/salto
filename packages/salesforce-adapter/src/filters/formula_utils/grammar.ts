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

import { $, getField, getObject, parts } from './utils'
import { CPQ_NAMESPACE, CUSTOM_METADATA_SUFFIX, NAMESPACE_SEPARATOR, SALESFORCE_CUSTOM_SUFFIX } from '../../constants'

const RELATIONSHIP_SUFFIX = '__R'
const USER_FIELDS = ['OWNER', 'MANAGER', 'CREATEDBY', 'LASTMODIFIEDBY']
const CUSTOM_LABEL_PREFIX = '$LABEL.'
const CUSTOM_SETTING_PREFIX = '$SETUP.'
const OBJECT_TYPE_PREFIX = '$OBJECTTYPE.'
const SELF_REFERENTIAL_PARENT_FIELD = 'PARENTID'
const SELF_REFERENTIAL_PARENT_OBJECT = 'PARENT'
const PROCESS_BUILDER_BRACKET_START = '['
const PROCESS_BUILDER_BRACKET_END = ']'
const SPECIAL_PREFIXES = ['$USER', '$PROFILE', '$ORGANIZATION', '$USERROLE', '$SYSTEM']


export const isUserField = (value: string): boolean => USER_FIELDS.includes($(getObject(value)))

export const isCustom = (value: string): boolean => value.toLocaleLowerCase().endsWith(SALESFORCE_CUSTOM_SUFFIX)

export const isCustomMetadata = (value: string): boolean => parts(value.toLocaleLowerCase())
  .some(part => part.includes(CUSTOM_METADATA_SUFFIX))

export const isCustomLabel = (value: string): boolean => $(value).startsWith(CUSTOM_LABEL_PREFIX)
export const isCustomSetting = (value: string): boolean => $(value).startsWith(CUSTOM_SETTING_PREFIX)
export const isObjectType = (value: string): boolean => $(value).startsWith(OBJECT_TYPE_PREFIX)
export const isParentField = (value: string): boolean => $(getField(value)) === SELF_REFERENTIAL_PARENT_FIELD
export const isParent = (value: string): boolean => $(value) === SELF_REFERENTIAL_PARENT_OBJECT
export const isStandardRelationship = (value: string): boolean => !$(value).endsWith(RELATIONSHIP_SUFFIX)
export const isRelationshipField = (value: string): boolean => value.includes('.')
export const isSpecialPrefix = (value: string): boolean => SPECIAL_PREFIXES.includes($(value))
export const isProcessBuilderPrefix = (value: string): boolean => (
  value.startsWith(PROCESS_BUILDER_BRACKET_START) && value.endsWith(PROCESS_BUILDER_BRACKET_END)
)
export const isCPQRelationship = (value: string): boolean => {
  const obj = $(getObject(value))

  return obj.startsWith(`${CPQ_NAMESPACE}${NAMESPACE_SEPARATOR}`) && obj.endsWith(RELATIONSHIP_SUFFIX)
}
