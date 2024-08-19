/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { getParents } from '@salto-io/adapter-utils'
import { isInstanceChange, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { client as clientUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { BRAND_THEME_TYPE_NAME } from '../constants'
import { deployChanges } from '../deprecated_deployment'

const log = logger(module)

const verifyBrandThemeIsDeleted = async (
  brandId: string,
  brandThemeId: string,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
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
const filterCreator: FilterCreator = ({ definitions }) => ({
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
      if (!(await verifyBrandThemeIsDeleted(brandId, brandThemeId, definitions.clients.options.main.httpClient))) {
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
