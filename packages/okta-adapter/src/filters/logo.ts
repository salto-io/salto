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

import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { BuiltinTypes, Element, CORE_ANNOTATIONS, Change, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile, getChangeData, isAdditionOrModificationChange, isRemovalChange, isStaticFile, DeployResult } from '@salto-io/adapter-api'
import FormData from 'form-data'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { getParent, getParents, normalizeFilePathPart, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterResult } from '@salto-io/adapter-utils/src/filter'
import OktaClient from '../client/client'
import { getOktaError } from '../deployment'
import { APP_LOGO_TYPE_NAME, BRAND_LOGO_TYPE_NAME, BRAND_TYPE_NAME, FAVORITE_ICON_TYPE_NAME, OKTA } from '../constants'
import { extractIdFromUrl } from '../utils'

const { awu } = collections.asynciterable
const log = logger(module)
const { SUBTYPES_PATH, TYPES_PATH, RECORDS_PATH } = elementsUtils
type BrandFileValues = {
  fileName: string
  fileType: string
  urlSuffix: string
}
// standard logo types for Okta
// https://developer.okta.com/docs/reference/api/brands/#response-10
const LOGO_TYPES_TO_VALUES: Record<string, BrandFileValues> = {
  [BRAND_LOGO_TYPE_NAME]: {
    fileName: 'brandLogo',
    fileType: 'png',
    urlSuffix: 'logo',
  },
  [FAVORITE_ICON_TYPE_NAME]: {
    fileName: 'favicon',
    fileType: 'ico',
    urlSuffix: 'favicon',
  },
}

const getLogoContent = async (link: string, client: OktaClient
): Promise<Buffer | undefined> => {
  const res = await client.getResource({ url: link, responseType: 'arraybuffer' })
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error('Received invalid response from Okta API for attachment content')
    return undefined
  }
  return content
}

const sendLogoRequest = async ({
  client,
  change,
  logoInstance,
  url,
  isRemoval,
}:{
  client: OktaClient
  change: Change<InstanceElement>
  logoInstance: InstanceElement
  url: string
  isRemoval: boolean
}): Promise<Error | void> => {
  const fileContent = isAdditionOrModificationChange(change)
  && isStaticFile(logoInstance.value.content)
    ? await logoInstance.value.content.getContent()
    : undefined
  try {
    if (isRemoval) {
      await client.delete({ url })
      return undefined
    }
    const form = new FormData()
    form.append('file', fileContent || Buffer.from(''), logoInstance.value.fileName)
    await client.post({
      url,
      data: form,
      headers: { ...form.getHeaders() },
    })
    return undefined
  } catch (e) {
    return getOktaError(logoInstance.elemID, e)
  }
}

export const deployLogo = async (
  change: Change<InstanceElement>,
  client: OktaClient,
): Promise<Error | void> => {
  const logoInstance = getChangeData(change)
  const logoTypeName = logoInstance.elemID.typeName
  let logoUrl: string
  try {
    if (logoTypeName === APP_LOGO_TYPE_NAME) {
      const appId = getParent(logoInstance).value.id
      logoUrl = `/api/v1/apps/${appId}/logo`
    } else {
      const brandTheme = getParents(logoInstance)[0].value
      const brand = getParents(logoInstance)[1].value
      const suffix = LOGO_TYPES_TO_VALUES[logoInstance.elemID.typeName].urlSuffix
      logoUrl = `/api/v1/brands/${brand.value.id}/themes/${brandTheme.value.id}/${suffix}`
    }
    if (isRemovalChange(change)) {
      return await sendLogoRequest({ client, change, logoInstance, url: logoUrl, isRemoval: true })
    }
    return await sendLogoRequest({ client, change, logoInstance, url: logoUrl, isRemoval: false })
  } catch (e) {
    return getOktaError(logoInstance.elemID, e)
  }
}

export const createLogoType = (objectTypeName: string): ObjectType =>
  new ObjectType({
    elemID: new ElemID(OKTA, objectTypeName),
    fields: {
      id: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      content: { refType: BuiltinTypes.STRING },
      contentType: { refType: BuiltinTypes.STRING },
      fileName: { refType: BuiltinTypes.STRING },
    },
    path: [OKTA, TYPES_PATH, SUBTYPES_PATH, objectTypeName, objectTypeName],
  })

export const getLogo = async ({
  client,
  parents,
  logoType,
  contentType,
  logoName,
  link,
}:{
  client: OktaClient
  parents: InstanceElement[]
  logoType: ObjectType
  contentType: string
  logoName?: string
  link?: string
}):
Promise<InstanceElement | undefined> => {
  const logoLink = link ?? parents[0].value?.[LOGO_TYPES_TO_VALUES[logoType.elemID.typeName].urlSuffix]
  if (logoLink === undefined) {
    return undefined
  }
  const logoContent = await getLogoContent(logoLink, client)
  if (logoContent === undefined) {
    return undefined
  }
  const name = logoName ?? LOGO_TYPES_TO_VALUES[logoType.elemID.typeName].fileName
  const pathName = pathNaclCase(name)
  const resourcePathName = `${normalizeFilePathPart(name)}.${contentType}`
  const logoId = extractIdFromUrl(logoLink)
  const refParents = parents.map(parent => new ReferenceExpression(parent.elemID, parent))
  const logo = new InstanceElement(
    name,
    logoType,
    {
      id: logoId,
      fileName: `${name}.${contentType}`,
      contentType,
      content: new StaticFile({
        filepath: `${OKTA}/${logoType.elemID.name}/${resourcePathName}`,
        content: logoContent,
      }),
    },
    [OKTA, RECORDS_PATH, logoType.elemID.typeName, pathName],
    {
      [CORE_ANNOTATIONS.PARENT]: refParents,
    }
  )
  return logo
}

export const getBrandLogoOrIcon = async (
  client: OktaClient,
  brandTheme: InstanceElement,
  logoType: ObjectType,
): Promise<InstanceElement | undefined> => {
  const parents = getParents(brandTheme)
  if (parents.length === 0 || parents[0].value.elemID.typeName !== BRAND_TYPE_NAME) {
    return undefined
  }
  const instances = [brandTheme, parents[0].value]
  const type = LOGO_TYPES_TO_VALUES[logoType.elemID.typeName].fileType
  return getLogo({ client, parents: instances, logoType, contentType: type })
}

export const fetchBrandThemeFiles = async ({
  brandTheme,
  client,
  logoTypeNames,
  elements,
}: {
  brandTheme: InstanceElement
  client: OktaClient
  logoTypeNames: string[]
  elements: Element[]
}): Promise<void | FilterResult> => {
  await awu(logoTypeNames).forEach(async logoTypeName => {
    const brandLogoType = createLogoType(logoTypeName)
    elements.push(brandLogoType)

    const brandLogoInstances = await getBrandLogoOrIcon(client, brandTheme, brandLogoType)
    if (brandLogoInstances !== undefined) {
      elements.push(brandLogoInstances)
    }
  })
}

export const deployBrandThemeFiles = async (
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
