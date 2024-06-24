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
import _ from 'lodash'
import { isInstanceChange, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'
import { deployChanges } from '../deployment'

const verifyProfileMappingIsDeleted = async (
  profileMappingId: string,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<boolean> => {
  try {
    return (
      (
        await client.get({
          url: `/api/v1/mappings/${profileMappingId}`,
        })
      ).status === 404
    )
  } catch (error) {
    if (error instanceof clientUtils.HTTPError && error.response?.status === 404) {
      return true
    }
    throw error
  }
}

/**
 * Override the default ProfileMapping removal with a verification of removal.
 *
 * ProfileMappings are removed automatically by Okta when either side of the mapping is removed, so instead only
 * verify that they are removed.
 * Separate change validator and dependency changer ensure that this is only executed if one of the mapping side was
 * removed in the same deploy action.
 */
const filterCreator: FilterCreator = ({ definitions }) => ({
  name: 'profileMappingRemovalFilter',
  deploy: async changes => {
    const client = definitions.clients.options.main.httpClient
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isRemovalChange(change) &&
        getChangeData(change).elemID.typeName === PROFILE_MAPPING_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      if (!(await verifyProfileMappingIsDeleted(getChangeData(change).value.id, client))) {
        throw new Error('Expected ProfileMapping to be deleted')
      }
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
