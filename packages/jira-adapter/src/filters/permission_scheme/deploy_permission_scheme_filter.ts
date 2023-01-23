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
import { isInstanceChange, getChangeData, Change, ChangeDataType, DeployResult, isAdditionChange } from '@salto-io/adapter-api'
import { objects } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isFreeLicense } from '../../utils'
import { PERMISSION_SCHEME_TYPE_NAME } from '../../constants'
import { FilterCreator } from '../../filter'

/**
 * prevents deployment of permission schemes if cloud free plan.
 */
const filter: FilterCreator = ({ client, elementsSource }) => ({
  deploy: async changes => {
    if (client.isDataCenter
      || !await isFreeLicense(elementsSource)) {
      return {
        leftoverChanges: changes,
        deployResult: {
          appliedChanges: [],
          errors: [],
        },
      }
    }
    // the condition for the filter should also include that the matching project is deployed,
    // but we don't have a way to know that at this point and addition is blocked anyway
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionChange(change)
        && getChangeData(change).elemID.typeName === PERMISSION_SCHEME_TYPE_NAME
    )
    const deployResult = relevantChanges
      .reduce((acc: Omit<DeployResult, 'extraProperties'>, change: Change<ChangeDataType>) => {
        const newDeploy = { appliedChanges: [change], errors: [] }
        return objects.concatObjects([acc, newDeploy])
      }, {
        appliedChanges: [],
        errors: [],
      },)

    return {
      leftoverChanges,
      deployResult,
    }
  },
})
export default filter
