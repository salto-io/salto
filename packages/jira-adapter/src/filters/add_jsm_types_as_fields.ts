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

import { isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { CUSTOMER_PERMISSIONS_TYPE, PROJECT_TYPE } from '../constants'

const filter: FilterCreator = ({ config }) => ({
  name: 'addJsmTypesAsFieldsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const customerPermissionInstances = _.remove(
      elements, e => e.elemID.typeName === CUSTOMER_PERMISSIONS_TYPE && isInstanceElement(e)
    )
    customerPermissionInstances
      .filter(isInstanceElement)
      .forEach(customerPermission => {
        const project = customerPermission.value.projectKey?.value
        delete customerPermission.value.projectKey
        if (project?.elemID.typeName === PROJECT_TYPE) {
          project.value.customerPermissions = customerPermission.value
        }
      })
  },
})
export default filter
