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

import _ from 'lodash'
import { Change, InstanceElement, getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { BRAND_LOGO_TYPE_NAME, BRAND_THEME_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { createLogoType, deployLogo, getBrandLogoOrIcon } from './logo'

const log = logger(module)

/**
 * Fetches and deploys brand logo as static file.
 */
const brandLogoFilter: FilterCreator = ({ client }) => ({
  name: 'brandLogoFilter',
  onFetch: async elements => {
    const brandTheme = elements
      .filter(isInstanceElement)
      .find(instance => instance.elemID.typeName === BRAND_THEME_TYPE_NAME)

    if (brandTheme === undefined) {
      log.debug('No brandTheme was found')
      return
    }
    const brandLogoType = createLogoType(BRAND_LOGO_TYPE_NAME)
    elements.push(brandLogoType)

    const brandLogoInstances = await getBrandLogoOrIcon(client, brandTheme, brandLogoType)
    if (brandLogoInstances !== undefined) {
      elements.push(brandLogoInstances)
    }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [brandLogoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_LOGO_TYPE_NAME,
    )
    const deployLogoResults = await Promise.all(brandLogoChanges.map(async change => {
      const deployResult = await deployLogo(change, client)
      return deployResult === undefined ? change : deployResult
    }))

    const [deployLogoErrors, successfulChanges] = _.partition(
      deployLogoResults,
      _.isError,
    )
    return {
      deployResult: {
        appliedChanges: successfulChanges,
        errors: deployLogoErrors,
      },
      leftoverChanges,
    }
  },
})

export default brandLogoFilter
