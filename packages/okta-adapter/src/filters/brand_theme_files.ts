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

import { Change, InstanceElement, ObjectType, isInstanceElement, DeployResult, getChangeData, SaltoError } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { BRAND_LOGO_TYPE_NAME, BRAND_THEME_TYPE_NAME, BRAND_TYPE_NAME, FAV_ICON_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { LOGO_TYPES_TO_VALUES, createLogoType, deployLogo, getLogo } from '../logo'
import OktaClient from '../client/client'

const log = logger(module)

const getBrandThemeFile = async (
  client: OktaClient,
  brandTheme: InstanceElement,
  logoType: ObjectType,
): Promise<InstanceElement | Error> => {
  const parents = getParents(brandTheme)
  if (parents.length === 0 || parents[0].value.elemID.typeName !== BRAND_TYPE_NAME) {
    log.warn('No Brand was found, skipping BrandLogo and BrandFavicon fetch')
    return new Error('No Brand was found, skipping BrandLogo and BrandFavicon fetch')
  }
  const instances = [brandTheme, parents[0].value]
  const type = LOGO_TYPES_TO_VALUES[logoType.elemID.typeName].fileType
  const link = brandTheme.value?.[LOGO_TYPES_TO_VALUES[logoType.elemID.typeName].urlSuffix]
  const logoName = LOGO_TYPES_TO_VALUES[logoType.elemID.typeName].fileName
  return getLogo({ client, parents: instances, logoType, contentType: type, link, logoName })
}

const deployBrandThemeFiles = async (
  changes: Change<InstanceElement>[],
  client: OktaClient,
): Promise<{
  deployResult: DeployResult
  leftoverChanges: Change[]
}> => {
  const [brandLogoChanges, leftoverChanges] = _.partition(
    changes,
    change => (Object.keys(LOGO_TYPES_TO_VALUES)).includes(getChangeData(change).elemID.typeName),
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
}
const toSaltoError = (err: Error): SaltoError => ({
  message: `Failed to fetch brandTheme file. ${err.message}`,
  severity: 'Warning',
})

/**
 * Fetches and deploys brand theme fiels as static file.
 */
const brandThemeFilesFilter: FilterCreator = ({ client }) => ({
  name: 'brandThemeFilesFilter',
  onFetch: async elements => {
    const brandTheme = elements
      .filter(isInstanceElement)
      .find(instance => instance.elemID.typeName === BRAND_THEME_TYPE_NAME)

    if (brandTheme === undefined) {
      log.warn('No BrandTheme was found, skipping BrandLogo and BrandFavicon fetch')
      const newEerr: SaltoError = {
        message: 'No BrandTheme was found, skipping BrandLogo and BrandFavicon fetch',
        severity: 'Warning',
      }
      return { errors: [newEerr] }
    }
    const logoTypeNames = [BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME]

    const allInstances = await Promise.all(logoTypeNames.map(async logoTypeName => {
      const brandLogoType = createLogoType(logoTypeName)
      elements.push(brandLogoType)
      return getBrandThemeFile(client, brandTheme, brandLogoType)
    }))

    const [fetchErrors, instances] = _.partition(allInstances, _.isError)
    instances.forEach(instance => elements.push(instance))
    const err = fetchErrors.map(toSaltoError)
    return { errors: err }
  },
  deploy: async (changes: Change<InstanceElement>[]) => deployBrandThemeFiles(changes, client),
})

export default brandThemeFilesFilter
