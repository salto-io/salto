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
import { AdditionChange, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, ModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { JiraConfig } from '../config/config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange } from '../deployment/standard_deployment'
import { getAllowedPermissionTypes } from '../change_validators/permission_type'
import { PERMISSION_SCHEME } from '../constants'
import JiraClient from '../client/client'

const log = logger(module)

const deployPermissionScheme = async (
  permissionScheme: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
  allowedPermissions: string[],
):Promise<void> => {
  const clonedPermissionSChemeChange = _.clone(permissionScheme)
  clonedPermissionSChemeChange.data.after.value.permissions = getChangeData(
    clonedPermissionSChemeChange
  ).value.permissions.filter((permission: { permission: string }) =>
    allowedPermissions.includes(permission.permission))
  await defaultDeployChange({
    change: clonedPermissionSChemeChange,
    client,
    apiDefinitions: config.apiDefinitions,
  })
}

const filter: FilterCreator = ({ client, elementsSource, config }) => ({
  deploy: async changes => {
    const allowedPermissions = await getAllowedPermissionTypes(elementsSource)
    if (allowedPermissions.length === 0) {
      log.warn('Could not find allowed permission types for permission Scheme filter. Skipping all permission schemes deploy')
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === PERMISSION_SCHEME
    )

    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      change => deployPermissionScheme(change, client, config, allowedPermissions)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
