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
import { CORE_ANNOTATIONS, isObjectType } from '@salto-io/adapter-api'
import { isDataObjectType } from '../types'
import { FilterWith } from '../filter'

const HIDDEN_FIELDS = ['internalId']

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'hiddenFields',
  onFetch: async elements => {
    elements
      .filter(isObjectType)
      .filter(isDataObjectType)
      .forEach(type => Object.values(type.fields)
        .forEach(field => {
          if (HIDDEN_FIELDS.includes(field.elemID.name)) {
            field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
          }
        }))
  },
})

export default filterCreator
