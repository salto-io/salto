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
import { getParents } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { APP_USER_SCHEMA_TYPE_NAME } from '../constants'
import { deployChanges } from '../deployment'
import OktaClient from '../client/client'

const verifyApplicationIsDeleted = async (applicationId: string, client: OktaClient): Promise<boolean> => {
  try {
    return (
      (
        await client.get({
          url: `/api/v1/apps/${applicationId}`,
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
 * Override the default AppUserSchema removal with a verification of removal.
 *
 * AppUserSchema are removed automatically by Okta when it's parent Application is removed, so instead only
 * verify that they are removed.
 * Separate change validator ensures that this is only executed if the application was
 * removed in the same deploy action.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  name: 'appUserSchemaRemovalFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isRemovalChange(change) &&
        getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const appUserSchemaInstance = getChangeData(change)
      const parentApplicationId = getParents(appUserSchemaInstance)[0]?.id
      if (!_.isString(parentApplicationId) || !(await verifyApplicationIsDeleted(parentApplicationId, client))) {
        throw new Error('Expected the parent Application to be deleted')
      }
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
