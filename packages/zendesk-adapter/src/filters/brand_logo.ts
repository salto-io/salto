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
import Joi from 'joi'
import {
  BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceElement, isStaticFile, ObjectType,
  ReferenceExpression, StaticFile,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { naclCase, safeJsonStringify, getParent, normalizeFilePathPart, pathNaclCase, elementExpressionStringifyReplacer } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import FormData from 'form-data'
import { collections } from '@salto-io/lowerdash'
import ZendeskClient from '../client/client'
import { BRAND_LOGO_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../constants'
import { getZendeskError } from '../errors'
import { FilterCreator } from '../filter'

const log = logger(module)
const { awu } = collections.asynciterable

const { RECORDS_PATH, SUBTYPES_PATH, TYPES_PATH } = elementsUtils

export const LOGO_FIELD = 'logo'

const RESULT_MAXIMUM_OUTPUT_SIZE = 100
const NUMBER_OF_DEPLOY_RETRIES = 5

type Brand = {
  logo: {
    id: number
  }
}

const EXPECTED_BRAND_SCHEMA = Joi.object({
  logo: Joi.object({
    id: Joi.number().required(),
  }).unknown(true).optional(),
}).unknown(true).required()

const isBrand = (value: unknown): value is Brand => {
  const { error } = EXPECTED_BRAND_SCHEMA.validate(value, { allowUnknown: true })
  if (error !== undefined) {
    log.error(`Received an invalid response for the brand values: ${error.message}, ${safeJsonStringify(value, elementExpressionStringifyReplacer)}`)
    return false
  }
  return true
}

export const BRAND_LOGO_TYPE = new ObjectType({
  elemID: new ElemID(ZENDESK, BRAND_LOGO_TYPE_NAME),
  fields: {
    id: {
      refType: BuiltinTypes.SERVICE_ID_NUMBER,
      annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    },
    filename: { refType: BuiltinTypes.STRING },
    contentType: { refType: BuiltinTypes.STRING },
    content: { refType: BuiltinTypes.STRING },
  },
  path: [ZENDESK, TYPES_PATH, SUBTYPES_PATH, BRAND_LOGO_TYPE_NAME],
})

const getLogoContent = async (
  client: ZendeskClient,
  logoId: string,
  logoFileName: string,
): Promise<Buffer | undefined> => {
  const res = await client.getResource({
    url: `/system/brands/${logoId}/${logoFileName}`,
    responseType: 'arraybuffer',
  })
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error(`Received invalid response from Zendesk API for logo content, ${
      Buffer.from(safeJsonStringify(res.data, undefined, 2)).toString('base64').slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)
    }. Not adding brand logo`)
    return undefined
  }
  return content
}

const getBrandLogo = async ({ client, brand }: {
  client: ZendeskClient
  brand: InstanceElement
}): Promise<InstanceElement | undefined> => {
  const logoValues = brand.value.logo
  if (logoValues === undefined) {
    return undefined
  }
  const name = elementsUtils.ducktype.toNestedTypeName(
    brand.value.name, logoValues.file_name
  )
  const pathName = pathNaclCase(naclCase(name))
  const resourcePathName = normalizeFilePathPart(name)

  const { id, file_name: filename } = brand.value.logo
  const content = await getLogoContent(client, id, filename)
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
        filepath: `${ZENDESK}/${BRAND_LOGO_TYPE.elemID.name}/${resourcePathName}`,
        content,
      }),
    },
    [ZENDESK, RECORDS_PATH, BRAND_LOGO_TYPE_NAME, pathName],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand.elemID, brand)] },
  )

  brand.value.logo = new ReferenceExpression(logoInstance.elemID, logoInstance)

  return logoInstance
}

const fetchBrand = async (
  client: ZendeskClient,
  brandId: string,
): Promise<Brand | undefined> => {
  const response = await client.getSinglePage({
    url: `/api/v2/brands/${brandId}`,
  })
  if (response === undefined) {
    log.error('Received empty response from Zendesk API. Not adding brand logo')
    return undefined
  }
  if (Array.isArray(response.data)) {
    log.error(`Received invalid response from Zendesk API, ${safeJsonStringify(response.data, undefined, 2).slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)}. Not adding brand logo`)
    return undefined
  }
  if (isBrand(response.data.brand)) {
    return response.data.brand
  }
  return undefined
}

const deployBrandLogo = async (
  client: ZendeskClient,
  logoInstance: InstanceElement,
  logoContent: Buffer | undefined,
): Promise<Error | void> => {
  try {
    const brandId = getParent(logoInstance).value.id
    // Zendesk's bug (ticket number 9800) might manipulate uploaded files - verification is needed
    for (let i = 1; i <= NUMBER_OF_DEPLOY_RETRIES; i += 1) {
      const form = new FormData()
      form.append('brand[logo][uploaded_data]', logoContent || Buffer.from(''), logoInstance.value.filename)
      // eslint-disable-next-line no-await-in-loop
      const putResult = await client.put({
        url: `/api/v2/brands/${brandId}`,
        data: form,
        headers: { ...form.getHeaders() },
      })
      if (logoContent === undefined) {
        return undefined
      }
      const updatedBrand = !_.isArray(putResult.data) && isBrand(putResult.data.brand)
        ? putResult.data.brand
        : undefined
      // eslint-disable-next-line no-await-in-loop
      const fetchedBrand = await fetchBrand(client, brandId)
      if (updatedBrand !== undefined
        && fetchedBrand !== undefined
        && fetchedBrand.logo.id === updatedBrand.logo.id) {
        return undefined
      }
      log.debug(`Re-uploading ${logoInstance.elemID.name} of the type brand_logo due to logo modification. Try number ${i}/${NUMBER_OF_DEPLOY_RETRIES}`)
    }
  } catch (err) {
    return getZendeskError(logoInstance.elemID, err)
  }
  return getZendeskError(logoInstance.elemID, new Error(`Can't deploy ${logoInstance.elemID.name} of the type brand_logo, due to Zendesk's API limitations. Please upload it manually in Zendesk Admin Center`))
}

/**
 * Supports brands' logo type and instances
 */
const filterCreator: FilterCreator = ({ client }) => ({
  name: 'brandLogoFilter',
  onFetch: async elements => {
    const brandsWithLogos = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)
      .filter(e => !_.isEmpty(e.value[LOGO_FIELD]))
    elements.push(BRAND_LOGO_TYPE)
    const logoInstances = (await Promise.all(
      brandsWithLogos.map(async brand => getBrandLogo({ client, brand }))
    ))
      .filter(isInstanceElement)
    logoInstances.forEach(instance => elements.push(instance))
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [brandLogoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_LOGO_TYPE_NAME,
    )

    // Making sure removals of brand_logo happens before the additions to cover elemID changes
    const [brandLogoRemovals, brandLogoAddistionsAndModifications] = _.partition(
      brandLogoChanges,
      change => change.action === 'remove',
    )
    const deployLogoResults = await awu(
      brandLogoRemovals.concat(brandLogoAddistionsAndModifications)
    )
      .map(async change => {
        const logoInstance = getChangeData(change)
        const fileContent = isAdditionOrModificationChange(change)
          && isStaticFile(logoInstance.value.content)
          ? await logoInstance.value.content.getContent()
          : undefined
        const deployResult = await deployBrandLogo(client, logoInstance, fileContent)
        return deployResult === undefined ? change : deployResult
      })
      .toArray()

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

export default filterCreator
