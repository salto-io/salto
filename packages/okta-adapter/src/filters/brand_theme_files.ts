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
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { BRAND_LOGO_TYPE_NAME, BRAND_THEME_TYPE_NAME, FAV_ICON_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { LOGO_TYPES_TO_VALUES, createLogoType, deployLogo, getLogo } from '../logo'
import OktaClient from '../client/client'

const logoTypeNames = [BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME]

const getBrandThemeFile = async (
  client: OktaClient,
  brandTheme: InstanceElement,
  logoType: ObjectType,
): Promise<InstanceElement | Error> => {
  const parents = getParents(brandTheme)
  const instances = [brandTheme, parents[0].value]
  const { fileType, urlSuffix } = LOGO_TYPES_TO_VALUES[logoType.elemID.typeName]
  const link = brandTheme.value?.[urlSuffix]
  return getLogo({
    client,
    parents: instances,
    logoType,
    contentType: fileType,
    link,
    logoName: brandTheme.elemID.name,
  })
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
    change => logoTypeNames.includes(getChangeData(change).elemID.typeName),
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
    const brandThemes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_THEME_TYPE_NAME)

    const [logoType, faviconType] = [createLogoType(BRAND_LOGO_TYPE_NAME), createLogoType(FAV_ICON_TYPE_NAME)]

    const brandLogosInstances = await Promise.all(brandThemes.map(async brand => {
      const logoInstance = await getBrandThemeFile(client, brand, logoType)
      const faviconInstance = await getBrandThemeFile(client, brand, faviconType)
      return [logoInstance, faviconInstance]
    }))

    const [fetchErrors, instances] = _.partition(brandLogosInstances.flat(), _.isError)
    instances.forEach(instance => elements.push(instance))
    const err = fetchErrors.map(toSaltoError)
    return { errors: err }
  },
  deploy: async (changes: Change<InstanceElement>[]) => deployBrandThemeFiles(changes, client),
})

export default brandThemeFilesFilter
