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
import semver from 'semver'
import { InstanceElement } from '@salto-io/adapter-api'
import { GROUP_MEMBERS_TYPE_NAME } from '../constants'

const MIGRATION_MESSAGE = 'A recently-added type was automatically added to the exclude list.'
const LAST_VERSION_TO_UPGRADE = '0.3.23'

/**
 * Adding the group_members type to the default exclude list, if the previous fetch
 * was on version <= 0.3.23.
 * Note: We do not currently handle the edge case where the adapter was added on an earlier version
 * and only fetched at a later version - in that case we may not exclude the group memberships
 * from the fetch.
 */
export const excludeGroupMembers = (
  config: InstanceElement | undefined,
  stateVersion: string | undefined,
): { config: [InstanceElement]; message: string } | undefined => {
  if (
    config === undefined
    || (stateVersion === undefined || semver.gt(stateVersion, LAST_VERSION_TO_UPGRADE))
    || (Array.isArray(config.value.exclude) && config.value.exclude.find(
      ({ type }: { type: string }) => type === GROUP_MEMBERS_TYPE_NAME
    ))
  ) {
    // nothing to upgrade
    return undefined
  }

  const updatedConfig = config.clone()
  updatedConfig.value.exclude = updatedConfig.value.exclude || []
  updatedConfig.value.exclude.push({ type: GROUP_MEMBERS_TYPE_NAME })

  return { config: [updatedConfig], message: MIGRATION_MESSAGE }
}
