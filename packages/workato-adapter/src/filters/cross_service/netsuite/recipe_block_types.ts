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
import _ from 'lodash'
import { CROSS_SERVICE_SUPPORTED_APPS, NETSUITE } from '../../../constants'
import { BlockBase, isListItem, RefListItem } from '../recipe_block_types'

export type NetsuiteBlock = BlockBase & {
  provider: 'netsuite' | 'netsuite_secondary'
  dynamicPickListSelection: {
    // eslint-disable-next-line camelcase
    netsuite_object: string
    // eslint-disable-next-line camelcase
    custom_list?: RefListItem[]
  }
  input?: {
    // eslint-disable-next-line camelcase
    netsuite_object: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNetsuiteBlock = (value: any, application: string): value is NetsuiteBlock =>
  _.isObjectLike(value) &&
  CROSS_SERVICE_SUPPORTED_APPS[NETSUITE].includes(application) &&
  value.provider === application &&
  _.isString(value.keyword) &&
  _.isObjectLike(value.dynamicPickListSelection) &&
  _.isString(value.dynamicPickListSelection.netsuite_object) &&
  (value.dynamicPickListSelection.custom_list ?? []).every(isListItem) &&
  _.isObjectLike(value.input) &&
  _.isString(value.input.netsuite_object)
