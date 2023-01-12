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

import { $, getField, getObject } from './utils'

export const RELATIONSHIP_SUFFIX = '__R'
export const USER_FIELDS = ['OWNER', 'MANAGER', 'CREATEDBY', 'LASTMODIFIEDBY']
export const CPQ_NAMESPACE = 'SBQQ__'
export const CUSTOM_METADATA_PREFIX = '__MDT'
export const CUSTOM_LABEL_PREFIX = '$LABEL.'
export const CUSTOM_SETTING_PREFIX = '$SETUP.'
export const CUSTOM_ENTITY_SUFFIX = '__C'
export const OBJECT_TYPE_PREFIX = '$OBJECTTYPE.'
export const SELF_REFERENTIAL_PARENT_FIELD = 'PARENTID'
export const SELF_REFERENTIAL_PARENT_OBJECT = 'PARENT'
export const PROCESS_BUILDER_BRACKET_START = '['
export const PROCESS_BUILDER_BRACKET_END = ']'
export const SPECIAL_PREFIXES = ['$USER', '$PROFILE', '$ORGANIZATION', '$USERROLE', '$SYSTEM']
export const isUserField = (value: string): boolean => USER_FIELDS.includes($(getObject(value)))
export const isCustom = (value: string): boolean => $(value).endsWith(CUSTOM_ENTITY_SUFFIX)
export const isCustomMetadata = (value: string): boolean => $(value).includes(CUSTOM_METADATA_PREFIX)
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

  return obj.startsWith(CPQ_NAMESPACE) && obj.endsWith(RELATIONSHIP_SUFFIX)
}
