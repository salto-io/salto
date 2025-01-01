/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import {
  Change,
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isSaltoError,
  isInstanceElement,
  isStaticFile,
  ObjectType,
  ReferenceExpression,
  SaltoElementError,
  SaltoError,
  StaticFile,
  isObjectType,
} from '@salto-io/adapter-api'
import { elements as elementsUtils, fetch as fetchUtils, client as clientUtils } from '@salto-io/adapter-components'
import {
  naclCase,
  safeJsonStringify,
  getParent,
  normalizeFilePathPart,
  pathNaclCase,
  inspectValue,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import FormData from 'form-data'
import { collections } from '@salto-io/lowerdash'
import ZendeskClient from '../client/client'
import { BRAND_LOGO_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../constants'
import { getZendeskError } from '../errors'
import { FilterCreator } from '../filter'

const log = logger(module)
const { awu } = collections.asynciterable

const { RECORDS_PATH } = elementsUtils

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
  })
    .unknown(true)
    .optional(),
})
  .unknown(true)
  .required()

const isBrand = (value: unknown): value is Brand => {
  const { error } = EXPECTED_BRAND_SCHEMA.validate(value, { allowUnknown: true })
  if (error !== undefined) {
    log.error(`Received an invalid response for the brand values: ${error.message}, ${inspectValue(value)}`)
    return false
  }
  return true
}

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
    log.error(
      `Received invalid response from Zendesk API for logo content, ${Buffer.from(
        safeJsonStringify(res.data, undefined, 2),
      )
        .toString('base64')
        .slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)}. Not adding brand logo`,
    )
    return undefined
  }
  return content
}

const getBrandLogo = async ({
  client,
  brand,
  brandLogoType,
}: {
  client: ZendeskClient
  brand: InstanceElement
  brandLogoType: ObjectType
}): Promise<InstanceElement | undefined> => {
  const logoValues = brand.value.logo
  if (logoValues === undefined) {
    return undefined
  }
  const name = fetchUtils.element.toNestedTypeName(brand.value.name, logoValues.file_name)
  const pathName = pathNaclCase(naclCase(name))
  const resourcePathName = normalizeFilePathPart(name)

  const { id, file_name: filename } = brand.value.logo
  const content = await getLogoContent(client, id, filename)
  if (content === undefined) {
    return undefined
  }
  const logoInstance = new InstanceElement(
    naclCase(name),
    brandLogoType,
    {
      id: logoValues.id,
      filename: logoValues.file_name,
      contentType: logoValues.content_type,
      content: new StaticFile({
        filepath: `${ZENDESK}/${brandLogoType.elemID.name}/${resourcePathName}`,
        content,
      }),
    },
    [ZENDESK, RECORDS_PATH, BRAND_LOGO_TYPE_NAME, pathName],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand.elemID, brand)] },
  )

  brand.value.logo = new ReferenceExpression(logoInstance.elemID, logoInstance)

  return logoInstance
}

const fetchBrand = async (client: ZendeskClient, brandId: string): Promise<Brand | undefined> => {
  const response = await client.get({
    url: `/api/v2/brands/${brandId}`,
  })
  if (response === undefined) {
    log.error('Received empty response from Zendesk API. Not adding brand logo')
    return undefined
  }
  if (Array.isArray(response.data)) {
    log.error(
      `Received invalid response from Zendesk API, ${safeJsonStringify(response.data, undefined, 2).slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)}. Not adding brand logo`,
    )
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
): Promise<SaltoElementError | void> => {
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
      const updatedBrand =
        !_.isArray(putResult.data) && isBrand(putResult.data.brand) ? putResult.data.brand : undefined
      // eslint-disable-next-line no-await-in-loop
      const fetchedBrand = await fetchBrand(client, brandId)
      if (updatedBrand !== undefined && fetchedBrand !== undefined && fetchedBrand.logo.id === updatedBrand.logo.id) {
        return undefined
      }
      log.debug(
        `Re-uploading ${logoInstance.elemID.name} of the type brand_logo due to logo modification. Try number ${i}/${NUMBER_OF_DEPLOY_RETRIES}`,
      )
    }
  } catch (err) {
    return getZendeskError(logoInstance.elemID, err)
  }
  return getZendeskError(
    logoInstance.elemID,
    new Error(
      `Can't deploy ${logoInstance.elemID.name} of the type brand_logo, due to Zendesk's API limitations. Please upload it manually in Zendesk Admin Center`,
    ),
  )
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
    const brandLogoType = elements.filter(isObjectType).find(e => e.elemID.typeName === BRAND_LOGO_TYPE_NAME)
    if (brandLogoType === undefined) {
      log.error('Failed to find brand logo type. Not fetching brand logos')
      return { errors: [] }
    }
    try {
      const logoInstances = (
        await Promise.all(brandsWithLogos.map(async brand => getBrandLogo({ client, brand, brandLogoType })))
      ).filter(isInstanceElement)
      logoInstances.forEach(instance => elements.push(instance))
      return { errors: [] }
    } catch (error) {
      if (error instanceof clientUtils.HTTPError && error.response.status === 403) {
        log.error('failed to get brand logos due to insufficient permissions with error %s', error.message)
        brandsWithLogos.forEach(brand => delete brand.value[LOGO_FIELD])
        return { errors: [fetchUtils.errors.getInsufficientPermissionsError(BRAND_LOGO_TYPE_NAME)] }
      }
      log.error('encountered an error while fetching brand logos %s', error.message)
      throw error
    }
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
    const deployLogoResults = await awu(brandLogoRemovals.concat(brandLogoAddistionsAndModifications))
      .map(async change => {
        const logoInstance = getChangeData(change)
        const fileContent =
          isAdditionOrModificationChange(change) && isStaticFile(logoInstance.value.content)
            ? await logoInstance.value.content.getContent()
            : undefined
        const deployResult = await deployBrandLogo(client, logoInstance, fileContent)
        return deployResult === undefined ? change : deployResult
      })
      .toArray()

    const [deployLogoErrors, successfulChanges] = _.partition(deployLogoResults, isSaltoError) as [
      SaltoError[],
      Change[],
    ]

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
