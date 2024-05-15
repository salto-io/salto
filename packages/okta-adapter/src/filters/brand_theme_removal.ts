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
import { getParents } from '@salto-io/adapter-utils'
import { isInstanceChange, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { client as clientUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { BRAND_THEME_TYPE_NAME } from '../constants'
import { deployChanges } from '../deployment'
import OktaClient from '../client/client'

const log = logger(module)

const verifyBrandThemeIsDeleted = async (
  brandId: string,
  brandThemeId: string,
  client: OktaClient,
): Promise<boolean> => {
  try {
    return (
      (
        await client.get({
          url: `/api/v1/brands/${brandId}/themes/${brandThemeId}`,
        })
      ).status === 404
    )
  } catch (error) {
    if (error instanceof clientUtils.HTTPError && error.response?.status === 404) {
      return true
    }
    log.error(`Failed to verify that BrandTheme ${brandThemeId} is deleted: ${error.message}`)
    throw error
  }
}

/**
 * Override the default BrandTheme removal with a verification of removal.
 *
 * BrandThemes are removed automatically by Okta when the Brand is removed, so only verify that they are removed.
 *
 * A separate change validator ensures that this is only executed if the Brand was removed in the same deploy action.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  name: 'brandThemeRemovalFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isRemovalChange(change) &&
        getChangeData(change).elemID.typeName === BRAND_THEME_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const brandId = getParents(getChangeData(change))[0]?.id
      const brandThemeId = getChangeData(change).value.id
      if (!(await verifyBrandThemeIsDeleted(brandId, brandThemeId, client))) {
        throw new Error('Expected BrandTheme to be deleted')
      }
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
