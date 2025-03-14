/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  InstanceElement,
  ObjectType,
  isInstanceElement,
  getChangeData,
  SaltoError,
} from '@salto-io/adapter-api'
import { ERROR_MESSAGES, getParents } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { BRAND_LOGO_TYPE_NAME, BRAND_THEME_TYPE_NAME, FAV_ICON_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { LOGO_TYPES_TO_VALUES, createFileType, deployLogo, getLogo } from '../logo'
import OktaClient from '../client/client'
import { deployChanges } from '../deprecated_deployment'

const logoTypeNames = [BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME]

const getBrandThemeFile = async (
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  brandTheme: InstanceElement,
  logoType: ObjectType,
): Promise<InstanceElement | Error> => {
  const parents = getParents(brandTheme)
  const instances = [brandTheme, parents[0].value]
  const { fileType, urlSuffix } = LOGO_TYPES_TO_VALUES[logoType.elemID.typeName]
  const link = brandTheme.value?.[urlSuffix]
  return getLogo({
    client: client as OktaClient,
    parents: instances,
    logoType,
    contentType: fileType,
    link,
    logoName: brandTheme.elemID.name,
    nestedPath: brandTheme.path?.slice(2, brandTheme.path?.length - 1) ?? [],
  })
}

const toSaltoError = (err: Error): SaltoError => ({
  message: ERROR_MESSAGES.OTHER_ISSUES,
  detailedMessage: `Failed to fetch brandTheme file. ${err.message}`,
  severity: 'Warning',
})

/**
 * Fetches and deploys brand theme fields as static file.
 */
const brandThemeFilesFilter: FilterCreator = ({ definitions }) => ({
  name: 'brandThemeFilesFilter',
  onFetch: async elements => {
    const client = definitions.clients.options.main.httpClient
    const brandThemes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_THEME_TYPE_NAME)

    const [logoType, faviconType] = [createFileType(BRAND_LOGO_TYPE_NAME), createFileType(FAV_ICON_TYPE_NAME)]
    elements.push(logoType, faviconType)

    const brandLogosInstances = await Promise.all(
      brandThemes.map(async brand => {
        const logoInstance = await getBrandThemeFile(client, brand, logoType)
        const faviconInstance = await getBrandThemeFile(client, brand, faviconType)
        return [logoInstance, faviconInstance]
      }),
    )

    const [fetchErrors, instances] = _.partition(brandLogosInstances.flat(), _.isError)
    instances.forEach(instance => elements.push(instance))
    const err = fetchErrors.map(toSaltoError)
    return { errors: err }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const client = definitions.clients.options.main.httpClient
    const [brandLogoChanges, leftoverChanges] = _.partition(changes, change =>
      logoTypeNames.includes(getChangeData(change).elemID.typeName),
    )

    const deployResult = await deployChanges(brandLogoChanges, async change => deployLogo(change, client as OktaClient))

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default brandThemeFilesFilter
