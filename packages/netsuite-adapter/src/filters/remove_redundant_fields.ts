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
import { getDeepInnerType, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { transformValues } from '@salto-io/adapter-utils'
import { FilterWith } from '../filter'
import { isDataObjectType } from '../types'

const { awu } = collections.asynciterable

const REDUNDANT_TYPES = ['NullField', 'CustomFieldList', 'CustomFieldRef']
const REDUNDANT_FIELDS = ['lastModifiedDate', 'dateCreated', 'createdDate', 'daysOverdue']

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'redundantFields',
  onFetch: async elements => {
    await awu(elements)
      .filter(isObjectType)
      .forEach(async e => {
        e.fields = Object.fromEntries(await awu(Object.entries(e.fields))
          .filter(async ([name, field]) => {
            const fieldType = await getDeepInnerType(await field.getType())
            return !REDUNDANT_FIELDS.includes(name)
              && !REDUNDANT_TYPES.includes(fieldType.elemID.name)
          }).toArray())
      })

    await awu(elements)
      .filter(isInstanceElement)
      .filter(async e => isDataObjectType(await e.getType()))
      .forEach(async e => {
        e.value = await transformValues({
          values: e.value,
          type: await e.getType(),
          transformFunc: ({ value, path }) => (
            path?.name === undefined || !REDUNDANT_FIELDS.includes(path.name) ? value : undefined
          ),
          strict: false,
          pathID: e.elemID,
        }) ?? e.value
      })


    _.remove(elements, e => REDUNDANT_TYPES.includes(e.elemID.name))
  },
})

export default filterCreator
