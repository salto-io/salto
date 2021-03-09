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
import _ from 'lodash'
import { CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS } from '../../constants'

type RefListItem = {
  label: string
  value: string
}

export type SalesforceBlock = {
  provider: 'salesforce'
  dynamicPickListSelection: {
    sobject_name: string
    field_list?: RefListItem[]
    table_list?: RefListItem[]
  }
  input: {
    sobject_name: string
  }
}
export type NetsuiteBlock = {
  provider: 'netsuite'
  dynamicPickListSelection: {
    netsuite_object: string
    custom_list?: RefListItem[]
  }
  input?: {
    netsuite_object: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isListItem = (value: any): value is RefListItem => (
  _.isObjectLike(value) && _.isString(value.label) && _.isString(value.value)
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSalesforceBlock = (value: any): value is SalesforceBlock => (
  _.isObjectLike(value)
  && value.provider === CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS.salesforce
  && _.isObjectLike(value.dynamicPickListSelection)
  && _.isString(value.dynamicPickListSelection.sobject_name)
  && (value.dynamicPickListSelection.table_list ?? []).every(isListItem)
  && (value.dynamicPickListSelection.field_list ?? []).every(isListItem)
  && _.isObjectLike(value.input)
  && _.isString(value.input.sobject_name)
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNetsuiteBlock = (value: any): value is NetsuiteBlock => (
  _.isObjectLike(value)
  && value.provider === CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS.netsuite
  && _.isObjectLike(value.dynamicPickListSelection)
  && _.isString(value.dynamicPickListSelection.netsuite_object)
  && (value.dynamicPickListSelection.custom_list ?? []).every(isListItem)
  && _.isObjectLike(value.input)
  && _.isString(value.input.netsuite_object)
)
