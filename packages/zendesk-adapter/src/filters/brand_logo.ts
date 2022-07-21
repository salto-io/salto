/*
*                      Copyright 2022 Salto Labs Ltd.
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
import FormData from 'form-data'
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement,
  isInstanceElement, ObjectType, ReferenceExpression, StaticFile,
  isStaticFile, Change, getChangeData, isRemovalChange, isModificationChange,
} from '@salto-io/adapter-api'
import { getParents, naclCase, pathNaclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { BRAND_LOGO_TYPE_NAME, BRAND_NAME, ZENDESK_SUPPORT } from '../constants'
import { getZendeskError } from '../errors'
import ZendeskClient from '../client/client'

const log = logger(module)

const { RECORDS_PATH, SUBTYPES_PATH, TYPES_PATH } = elementsUtils

export const LOGO_FIELD = 'logo'

export const BRAND_LOGO_TYPE = new ObjectType({
  elemID: new ElemID(ZENDESK_SUPPORT, BRAND_LOGO_TYPE_NAME),
  fields: {
    id: {
      refType: BuiltinTypes.SERVICE_ID_NUMBER,
      annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    },
    filename: { refType: BuiltinTypes.STRING },
    contentType: { refType: BuiltinTypes.STRING },
    content: { refType: BuiltinTypes.STRING },
  },
  path: [ZENDESK_SUPPORT, TYPES_PATH, SUBTYPES_PATH, BRAND_LOGO_TYPE_NAME],
})

const getLogoContent = async (
  client: ZendeskClient,
  brand: InstanceElement,
): Promise<Buffer | undefined> => {
  const res = await client.getResource({
    url: `/brands/${brand.value.logo.id}/${brand.value.logo.file_name}`,
    responseType: 'arraybuffer',
  })
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error(`Received invalid response from Zendesk API for logo content, ${safeJsonStringify(res.data, undefined, 2)}. Not adding brand logo`)
    return undefined
  }
  return content
}

const getBrandLogo = async ({ client, brand }: {
  client: ZendeskClient
  brand: InstanceElement
}): Promise<InstanceElement | undefined> => {
  const logoValues = brand.value.logo
  const name = elementsUtils.ducktype.toNestedTypeName(
    brand.value.name, logoValues.file_name
  )
  const pathName = pathNaclCase(name)

  const content = await getLogoContent(client, brand)
  if (content === undefined) {
    return undefined
  }
  const logoInstance = new InstanceElement(
    naclCase(name),
    BRAND_LOGO_TYPE,
    {
      id: logoValues.id,
      filename: logoValues.file_name,
      contentType: logoValues.content_type,
      content: new StaticFile({
        filepath: `${ZENDESK_SUPPORT}/${BRAND_LOGO_TYPE.elemID.name}/${pathName}`,
        content,
      }),
    },
    [ZENDESK_SUPPORT, RECORDS_PATH, BRAND_LOGO_TYPE_NAME, pathName],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand.elemID, brand)] },
  )

  brand.value.logo = new ReferenceExpression(logoInstance.elemID, logoInstance)

  return logoInstance
}

const modifyBrandLogo = async (
  client: ZendeskClient,
  logoInstance: InstanceElement,
  logoContent: Buffer | undefined,
): ReturnType<typeof client.put> => {
  const form = new FormData()
  form.append('brand[logo][uploaded_data]', logoContent || Buffer.from(''), logoInstance.value.filename)
  try {
    const brandId = getParents(logoInstance)?.[0].resValue.value.id
    return await client.put({
      url: `/brands/${brandId}`,
      data: form,
      headers: { ...form.getHeaders() },
    })
  } catch (err) {
    throw getZendeskError(logoInstance.elemID.getFullName(), err)
  }
}

/**
 * Supports brands' logo type and instances
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async elements => {
    const brandsWithLogos = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_NAME)
      .filter(e => !_.isEmpty(e.value[LOGO_FIELD]))
    const logoInstances = (await Promise.all(
      brandsWithLogos.map(async brand => getBrandLogo({ client, brand }))
    )).filter(isInstanceElement)
    elements.push(BRAND_LOGO_TYPE, ...logoInstances)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [brandLogoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_LOGO_TYPE_NAME,
    )

    brandLogoChanges.map(async change => {
      const logoInstance = getChangeData(change)
      const fileContent = !isRemovalChange(change) && isStaticFile(logoInstance.value.content)
        ? await logoInstance.value.content.getContent()
        : undefined
      await modifyBrandLogo(client, logoInstance, fileContent)
    })

    const logoFieldBrandModificationChanges = leftoverChanges
      .filter(change => getChangeData(change).elemID.typeName === BRAND_NAME)
      .filter(isModificationChange)
      .filter(change => change.data.before.value.logo !== undefined)
      .filter(change => change.data.after.value.logo !== undefined)
      .filter(change => change.data.before.value.logo !== change.data.after.value.logo)

    logoFieldBrandModificationChanges
      .map(change => change.data.after.value.logo)
      .map(async logoInstance => {
        const fileContent = await logoInstance.value.content.getContent()
        await modifyBrandLogo(client, logoInstance, fileContent)
      })

    return {
      deployResult: {
        appliedChanges: [...brandLogoChanges, ...logoFieldBrandModificationChanges],
        errors: [],
      },
      leftoverChanges,
    }
  },
})

export default filterCreator
