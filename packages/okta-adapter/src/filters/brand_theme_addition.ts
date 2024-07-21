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
import {
  Change,
  InstanceElement,
  isInstanceChange,
  getChangeData,
  isAdditionChange,
  SaltoElementError,
  isSaltoElementError,
  isSaltoError,
  createSaltoElementErrorFromError,
  createSaltoElementError,
  SaltoError,
} from '@salto-io/adapter-api'
import { getParents, inspectValue } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { BRAND_THEME_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

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

const AddIdToBrandTheme = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<undefined | SaltoError> => {
  const instance = getChangeData(change)
  const brandId = getParents(instance)[0]?.id
  if (!_.isString(brandId)) {
    // Parent reference is already resolved
    log.error(`Failed to deploy BrandTheme with brandId: ${brandId}`)
    return createSaltoElementError({
      message: 'BrandTheme must have valid brandId',
      severity: 'Error',
      elemID: instance.elemID,
    })
  }
  try {
    const themeId = await getThemeIdByBrand(brandId, client)
    // Assign the existing id to the added brand theme
    instance.value.id = themeId
  } catch (error) {
    return createSaltoElementErrorFromError({
      error,
      severity: 'Error',
      elemID: instance.elemID,
    })
  }
  return undefined
}

/**
 * Find and set the ID for an existing theme, to allow the deploy to succeed.
 *
 * The actual deploy of the BrandTheme is done by the standard deploy mechanism,
 * this filter only adds the ID.
 */
const filterCreator: FilterCreator = ({ definitions }) => ({
  name: 'brandThemeAdditionFilter',
  deploy: async changes => {
    const results = await Promise.all(
      changes
        .filter(isInstanceChange)
        .filter(isAdditionChange)
        .filter(change => getChangeData(change).elemID.typeName === BRAND_THEME_TYPE_NAME)
        .map(change => AddIdToBrandTheme(change, definitions.clients.options.main.httpClient)),
    )
    const errors: SaltoElementError[] = results.filter(isSaltoError).filter(isSaltoElementError)
    const leftoverChanges = changes.filter(
      change => !errors.map(error => error.elemID).includes(getChangeData(change).elemID),
    )
    return { leftoverChanges, deployResult: { errors, appliedChanges: [] } }
  },
})

export default filterCreator
