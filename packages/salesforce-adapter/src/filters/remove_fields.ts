/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  isObjectType, ElemID,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import { id } from './utils'

const allRemovedFields: {id: ElemID; fields: string[]}[] = [
  {
    id: new ElemID(SALESFORCE, 'Profile'),
    fields: ['tabVisibilities'],
  },
]

export const makeFilter = (
  removedFields: Record<string, string[]>
): FilterCreator => () => ({
  onFetch: async function onFetch(elements) {
    // Remove fields from types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToRemove = removedFields[id(elem)]
      if (fieldsToRemove !== undefined) {
        fieldsToRemove.forEach(fieldName => { delete elem.fields[fieldName] })
      }
    })
  },
})

export default makeFilter(
  _(allRemovedFields)
    .map(RemovedField => [RemovedField.id.getFullName(), RemovedField.fields])
    .fromPairs()
    .value(),
)
