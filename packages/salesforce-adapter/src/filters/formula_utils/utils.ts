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


const STANDARD_RELATIONSHIP_ID_NAME = 'Id'
const DOLLAR_SIGN = '$'

export const $ = (value: string): string => value.toUpperCase()
export const parts = (value: string): string[] => value.split('.')
export const getObject = (value: string): string => parts(value)[0]
export const getField = (value: string): string => parts(value)[1]

export const createApiName = (object: string, field: string): string => `${object}.${field}`
export const removePrefix = (value: string): string => (
  value.startsWith(DOLLAR_SIGN) ? value.substring(1) : value
)
export const removeFirstAndLastChars = (value: string): string => value.slice(1).slice(0, -1)
export const transformToId = (value: string): string => value + STANDARD_RELATIONSHIP_ID_NAME
export const transformToUserField = (value: string): string => `User.${getField(value)}`
export const replaceRwithC = (value: string): string => value.slice(0, -1).concat('c')
