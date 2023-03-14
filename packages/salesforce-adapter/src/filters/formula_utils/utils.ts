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

const STANDARD_RELATIONSHIP_ID_NAME = 'Id'

export const parts = (value: string): string[] => value.split('.')
export const getObject = (value: string): string => parts(value)[0]
export const getField = (value: string): string => parts(value)[1]

export const createApiName = (object: string, field: string): string => `${object}.${field}`
export const canonicalizeProcessBuilderIdentifier = (value: string): string => _.trim(value, '[]')
export const transformToId = (fieldName: string): string => `${fieldName}${STANDARD_RELATIONSHIP_ID_NAME}`
export const transformToUserField = (identifier: string): string => `User.${getField(identifier)}`
