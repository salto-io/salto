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

import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { BuiltinTypes, CORE_ANNOTATIONS, Change, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile, getChangeData, isAdditionOrModificationChange, isRemovalChange, isStaticFile } from '@salto-io/adapter-api'
import FormData from 'form-data'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { getParent, getParents, normalizeFilePathPart, pathNaclCase } from '@salto-io/adapter-utils'
import { getResource } from '../client/connection'
import OktaClient from '../client/client'
import { getOktaError } from '../deployment'
import { APP_LOGO_TYPE_NAME, BRAND_LOGO_TYPE_NAME, BRAND_TYPE_NAME, FAVORITE_ICON_TYPE_NAME, OKTA } from '../constants'
import { extractIdFromUrl } from '../utils'

const log = logger(module)
const { SUBTYPES_PATH, TYPES_PATH, RECORDS_PATH } = elementsUtils
type brandLogoOrIconValues = {
  fileName: string
  fileType: string
  urlSuffix: string
}
// standatrd logo types for Okta
const LOGO_TYPES_TO_VALUES: Record<string, brandLogoOrIconValues> = {
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

export const getLogoContent = async (link: string
): Promise<Buffer | undefined> => {
  const res = await getResource(link, 'arraybuffer')
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error('Received invalid response from Okta API for attachment content')
    return undefined
  }
  return content
}

export const sendLogoRequest = async (
  client: OktaClient,
  change: Change<InstanceElement>,
  logoInstance: InstanceElement,
  url: string,
  isRemoval: boolean,
): Promise<Error | void> => {
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
      return await sendLogoRequest(client, change, logoInstance, logoUrl, true)
    }
    return await sendLogoRequest(client, change, logoInstance, logoUrl, false)
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

export const getLogo = async (
  parents: InstanceElement[],
  logoType: ObjectType,
  contentType: string,
  logoName?: string,
  link?: string,
):
Promise<InstanceElement | undefined> => {
  const logoLink = link ?? parents[0].value?.logo
  if (logoLink === undefined) {
    return undefined
  }
  const logoContent = await getLogoContent(logoLink)
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
  brandTheme: InstanceElement,
  logoType: ObjectType,
): Promise<InstanceElement | undefined> => {
  const parents = getParents(brandTheme)
  if (parents.length === 0 || parents[0].value.elemID.typeName !== BRAND_TYPE_NAME) {
    return undefined
  }
  const instances = [brandTheme, parents[0].value]
  const type = LOGO_TYPES_TO_VALUES[logoType.elemID.typeName].fileType
  return getLogo(instances, logoType, type)
}
