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
import { BRAND_THEME_TYPE_NAME, FAVORITE_ICON_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { createLogoType, deployLogo, getBrandLogoOrIcon } from './logo'

const log = logger(module)

const favIconFilter: FilterCreator = ({ client }) => ({
  name: 'favIconFilter',
  onFetch: async elements => {
    const brandTheme = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_THEME_TYPE_NAME)

    if (brandTheme.length === 0) {
      log.debug('No brandTheme was found')
    }
    const favIconType = createLogoType(FAVORITE_ICON_TYPE_NAME)
    elements.push(favIconType)
    const favIconInstances = (await Promise.all(brandTheme.map(async theme => getBrandLogoOrIcon(theme, favIconType))))
      .filter(isInstanceElement)
    favIconInstances.forEach(logo => elements.push(logo))
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [favIconChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === FAVORITE_ICON_TYPE_NAME,
    )
    const deployLogoResults = await Promise.all(favIconChanges.map(async change => {
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

export default favIconFilter
