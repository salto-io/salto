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
import { Change, InstanceElement, isInstanceChange, getChangeData, isAdditionChange } from '@salto-io/adapter-api'
import { getParents, inspectValue } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { BRAND_THEME_TYPE_NAME } from '../constants'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange } from '../deployment'

const log = logger(module)

const getThemeIdByBrand = async (
  brandId: string,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<string> => {
  const themeEntries = (
    await client.get({
      url: `/api/v1/brands/${brandId}/themes`,
    })
  ).data
  if (_.isArray(themeEntries) && themeEntries.length === 1 && _.isString(themeEntries[0].id)) {
    return themeEntries[0].id
  }
  log.error(`Received unexpected result for brand theme for brandId ${brandId}: ${inspectValue(themeEntries)}`)
  throw new Error('Could not find BrandTheme with the provided brandId')
}

const deployBrandThemeAddition = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const instance = getChangeData(change)
  const brandId = getParents(instance)[0]?.id
  if (!_.isString(brandId)) {
    // Parent reference is already resolved
    log.error(`Failed to deploy BrandTheme with brandId: ${brandId}`)
    throw new Error('BrandTheme must have valid brandId')
  }
  const themeId = await getThemeIdByBrand(brandId, client)
  // Assign the existing id to the added brand theme
  instance.value.id = themeId
  await defaultDeployChange(change, client, apiDefinitions)
}

/**
 * Deploy addition changes of BrandTheme instances, by finding the ID of the existing theme and updating it.
 */
const filterCreator: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'brandThemeAdditionFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionChange(change) &&
        getChangeData(change).elemID.typeName === BRAND_THEME_TYPE_NAME,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change =>
      deployBrandThemeAddition(
        change,
        definitions.clients.options.main.httpClient,
        oldApiDefinitions[API_DEFINITIONS_CONFIG],
      ),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
