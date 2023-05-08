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
import _ from 'lodash'
import { strings, values } from '@salto-io/lowerdash'
import { FILE, FOLDER } from '../constants'
import { CustomizationInfo, CustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo, TemplateCustomTypeInfo } from './types'
import { NetsuiteTypesQueryParams } from '../query'

const { matchAll } = strings
const { isDefined } = values

export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)))

export const isCustomTypeInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is CustomTypeInfo => 'scriptId' in customizationInfo

export const isTemplateCustomTypeInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is TemplateCustomTypeInfo =>
  'fileExtension' in customizationInfo && isCustomTypeInfo(customizationInfo)

export const isFileCustomizationInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is FileCustomizationInfo =>
  customizationInfo.typeName === FILE

export const isFolderCustomizationInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is FolderCustomizationInfo =>
  customizationInfo.typeName === FOLDER

export const mergeTypeToInstances = (
  ...typeToInstances: NetsuiteTypesQueryParams[]
): NetsuiteTypesQueryParams =>
  _.mergeWith(
    {},
    ...typeToInstances,
    (objValue: string[] | undefined, srcValue: string[]) => (
      objValue ? [...objValue, ...srcValue] : srcValue
    )
  )

export const getGroupItemFromRegex = (str: string, regex: RegExp, item: string): string[] =>
  Array.from(matchAll(str, regex))
    .map(r => r.groups)
    .filter(isDefined)
    .map(groups => groups[item])
