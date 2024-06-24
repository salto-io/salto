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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Change,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  getChangeData,
  isAdditionOrModificationChange,
  isRemovalChange,
  isStaticFile,
} from '@salto-io/adapter-api'
import FormData from 'form-data'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { getParent, getParents, normalizeFilePathPart, pathNaclCase } from '@salto-io/adapter-utils'
import OktaClient from './client/client'
import { getOktaError } from './deployment'
import { APP_LOGO_TYPE_NAME, BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME, OKTA } from './constants'
import { extractIdFromUrl } from './utils'

const { SUBTYPES_PATH, TYPES_PATH, RECORDS_PATH } = elementsUtils

type BrandFileValues = {
  fileType: string
  urlSuffix: string
}
// standard logo types for Okta
// https://developer.okta.com/docs/reference/api/brands/#response-10
export const LOGO_TYPES_TO_VALUES: Record<string, BrandFileValues> = {
  [BRAND_LOGO_TYPE_NAME]: {
    fileType: 'png',
    urlSuffix: 'logo',
  },
  [FAV_ICON_TYPE_NAME]: {
    fileType: 'ico',
    urlSuffix: 'favicon',
  },
}

const getLogoContent = async (link: string, client: OktaClient): Promise<Buffer | Error> => {
  try {
    const res = await client.getResource({ url: link, responseType: 'arraybuffer' })
    const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
    if (!Buffer.isBuffer(content)) {
      return new Error('Received invalid response from Okta API for attachment content')
    }
    return content
  } catch (e) {
    return new Error('Failed to fetch attachment content from Okta API')
  }
}

const sendLogoRequest = async ({
  client,
  change,
  logoInstance,
  url,
  isRemoval,
}: {
  client: OktaClient
  change: Change<InstanceElement>
  logoInstance: InstanceElement
  url: string
  isRemoval: boolean
}): Promise<void> => {
  const fileContent =
    isAdditionOrModificationChange(change) && isStaticFile(logoInstance.value.content)
      ? await logoInstance.value.content.getContent()
      : undefined
  if (isRemoval) {
    try {
      await client.delete({ url })
    } catch (e) {
      if (e.response?.status === 404) {
        // Okta returns 404 if the logo was already removed
        return undefined
      }
      throw e
    }
    return undefined
  }
  const form = new FormData()
  form.append('file', fileContent || Buffer.from(''), logoInstance.value.fileName)
  // client supports logo upload only with form-data.
  await client.post({
    url,
    data: form,
    headers: { ...form.getHeaders() },
  })
  return undefined
}

export const deployLogo = async (change: Change<InstanceElement>, client: OktaClient): Promise<void> => {
  const logoInstance = getChangeData(change)
  const { typeName } = logoInstance.elemID
  let logoUrl: string
  try {
    if (typeName === APP_LOGO_TYPE_NAME) {
      const appId = getParent(logoInstance).value.id
      logoUrl = `/api/v1/apps/${appId}/logo`
    } else {
      const brandTheme = getParents(logoInstance)[0].value
      const brand = getParents(logoInstance)[1].value
      const suffix = LOGO_TYPES_TO_VALUES[logoInstance.elemID.typeName].urlSuffix
      logoUrl = `/api/v1/brands/${brand.value.id}/themes/${brandTheme.value.id}/${suffix}`
    }
    await sendLogoRequest({ client, change, logoInstance, url: logoUrl, isRemoval: isRemovalChange(change) })
  } catch (e) {
    throw getOktaError(logoInstance.elemID, e)
  }
}

export const createFileType = (objectTypeName: string): ObjectType =>
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
  nestedPath = [],
}: {
  client: OktaClient
  parents: InstanceElement[]
  logoType: ObjectType
  contentType: string
  logoName: string
  link: string
  nestedPath?: string[]
}): Promise<InstanceElement | Error> => {
  const logoContent = await getLogoContent(link, client)
  if (logoContent instanceof Error) {
    return logoContent
  }
  const pathName = pathNaclCase(logoName)
  const camelCaseName = pathName.replace(/_/g, '')
  const resourcePathName = `${normalizeFilePathPart(camelCaseName)}.${contentType}`
  const logoId = extractIdFromUrl(link)
  const refParents = parents.map(parent => new ReferenceExpression(parent.elemID, parent))
  const logo = new InstanceElement(
    logoName,
    logoType,
    {
      id: logoId,
      fileName: `${camelCaseName}.${contentType}`,
      contentType,
      content: new StaticFile({
        filepath: `${OKTA}/${logoType.elemID.name}/${resourcePathName}`,
        content: logoContent,
      }),
    },
    [OKTA, RECORDS_PATH, ...nestedPath, logoType.elemID.typeName, pathName],
    {
      [CORE_ANNOTATIONS.PARENT]: refParents,
    },
  )
  return logo
}
