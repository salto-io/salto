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
import { InstanceElement, isInstanceElement, isReferenceExpression, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'

type ValueToSort = {
  typeName: string
  fieldName: string
  sortBy: string[]
}

const VALUES_TO_SORT: ValueToSort[] = [
  {
    typeName: 'PermissionScheme',
    fieldName: 'permissions',
    sortBy: ['permission', 'holder.type', 'holder.parameter'],
  },
]

const getValue = (value: Value): Value => (
  isReferenceExpression(value) ? value.elemID.getFullName() : value
)

const sortLists = (instance: InstanceElement): void => {
  VALUES_TO_SORT
    .filter(({ typeName }) => instance.elemID.typeName === typeName)
    .forEach(({ fieldName, sortBy }) => {
      if (instance.value[fieldName] === undefined) {
        return
      }

      instance.value[fieldName] = _.orderBy(
        instance.value[fieldName],
        sortBy.map(fieldPath => item => getValue(_.get(item, fieldPath))),
      )
    })
}

const filter: FilterCreator = () => ({
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .forEach(sortLists)
  },
})

export default filter
