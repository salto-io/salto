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
import { Change, getChangeData, InstanceElement, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const PERMISSION_SCHEME_TYPE_NAME = 'PermissionScheme'

const sortPermissionScheme = (instance: InstanceElement): void => {
  if (instance.value.permissions === undefined) {
    return
  }

  instance.value.permissions = _.sortBy(
    instance.value.permissions,
    permission => safeJsonStringify(permission)
  )
}

const filter: FilterCreator = () => ({
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME)
      .forEach(sortPermissionScheme)
  },

  onDeploy: async changes => awu(changes)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === PERMISSION_SCHEME_TYPE_NAME)
    .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
      change,
      instance => {
        sortPermissionScheme(instance)
        return instance
      }
    )),
})

export default filter
