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

import { Change, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { BRAND_LOGO_TYPE_NAME, BRAND_THEME_TYPE_NAME, FAVORITE_ICON_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { deployBrandThemeFiles, fetchBrandThemeFiles } from './logo'

const log = logger(module)

/**
 * Fetches and deploys brand logo as static file.
 */
const brandLogoFilter: FilterCreator = ({ client }) => ({
  name: 'brandThemeFilesFilter',
  onFetch: async elements => {
    const brandTheme = elements
      .filter(isInstanceElement)
      .find(instance => instance.elemID.typeName === BRAND_THEME_TYPE_NAME)

    if (brandTheme === undefined) {
      log.debug('No brandTheme was found')
      return
    }
    // eslint-disable-next-line max-len
    await fetchBrandThemeFiles({ client, brandTheme, elements, logoTypeNames: [BRAND_LOGO_TYPE_NAME, FAVORITE_ICON_TYPE_NAME] })
    // await fetchBrandThemeFiles({ client, brandTheme, elements, logoTypeName: BRAND_LOGO_TYPE_NAME })
    // await fetchBrandThemeFiles({ client, brandTheme, elements, logoTypeName: FAVORITE_ICON_TYPE_NAME })
  },
  deploy: async (changes: Change<InstanceElement>[]) => deployBrandThemeFiles(changes, client),
})

export default brandLogoFilter
