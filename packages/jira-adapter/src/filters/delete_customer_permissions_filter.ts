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

import { Change, InstanceElement, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { CUSTOMER_PERMISSIONS_TYPE } from '../constants'

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'deleteCustomerPermissionsFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    if (!config.fetch.enableJSM) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [removalCustomerPermissionsChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        getChangeData(change).elemID.typeName === CUSTOMER_PERMISSIONS_TYPE
          && isRemovalChange(change)
    )

    const deployResult = {
      errors: [],
      appliedChanges: removalCustomerPermissionsChanges,
    }
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
