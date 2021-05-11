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
import { isContainerType, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const REDUNDANT_TYPES = ['NullField', 'CustomFieldList', 'CustomFieldRef']


const filterCreator: FilterCreator = () => ({
  onFetch: async ({ elements }) => {
    elements.filter(isObjectType).forEach(e => {
      REDUNDANT_TYPES.forEach(type => {
        e.fields = _.pickBy(e.fields, (field => {
          const fieldType = isContainerType(field.type) ? field.type.innerType : field.type
          return fieldType.elemID.name !== type
        }))
      })
    })

    _.remove(elements, e => REDUNDANT_TYPES.includes(e.elemID.name))
  },
})

export default filterCreator
