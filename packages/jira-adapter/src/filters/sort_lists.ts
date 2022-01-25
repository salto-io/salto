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
import { Change, InstanceElement, isInstanceChange, isInstanceElement, isReferenceExpression, Value } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

type ValueToSort = {
  typeName: string
  fieldName: string
  sortBy: string[][]
}

const VALUES_TO_SORT: ValueToSort[] = [
  {
    typeName: 'PermissionScheme',
    fieldName: 'permissions',
    sortBy: [['permission'], ['holder', 'type'], ['holder', 'parameter']],
  },
]

const getValue = (value: Value): Value => (
  isReferenceExpression(value) ? value.elemID.getFullName() : value
)

const getSortKey = (value: Value, sortByFields: string[][]): string =>
  sortByFields.map(fieldPath => getValue(_.get(value, fieldPath))).join('-')

const sortLists = (instance: InstanceElement): void => {
  VALUES_TO_SORT
    .filter(({ typeName }) => instance.elemID.typeName === typeName)
    .forEach(({ fieldName, sortBy }) => {
      if (instance.value[fieldName] === undefined) {
        return
      }

      instance.value[fieldName] = _.sortBy(
        instance.value[fieldName],
        value => getSortKey(value, sortBy),
      )
    })
}

const filter: FilterCreator = () => ({
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .forEach(sortLists)
  },

  onDeploy: async changes => awu(changes)
    .filter(isInstanceChange)
    .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
      change,
      instance => {
        sortLists(instance)
        return instance
      }
    )),
})

export default filter
