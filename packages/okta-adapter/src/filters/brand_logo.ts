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
import { BuiltinTypes, CORE_ANNOTATIONS, Change, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile, getChangeData, isAdditionOrModificationChange, isInstanceElement, isStaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { getParent, getParents, normalizeFilePathPart, pathNaclCase } from '@salto-io/adapter-utils'
import FormData from 'form-data'
import { BRAND_LOGO_TYPE_NAME, BRAND_THEME_TYPE_NAME, OKTA } from '../constants'
import { FilterCreator } from '../filter'
import { extractIdFromUrl } from '../utils'
import OktaClient from '../client/client'
import { getOktaError } from '../deployment'
import { getLogoContent } from './logo'

const log = logger(module)
const { TYPES_PATH, SUBTYPES_PATH, RECORDS_PATH } = elementsUtils

const createBrandLogoType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(OKTA, BRAND_LOGO_TYPE_NAME),
    fields: {
      id: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      content: { refType: BuiltinTypes.STRING },
      fileName: { refType: BuiltinTypes.STRING },
    },
    path: [OKTA, TYPES_PATH, SUBTYPES_PATH, BRAND_LOGO_TYPE_NAME, BRAND_LOGO_TYPE_NAME],
  })


const getBrandLogo = async (brandTheme: InstanceElement, brandLogoType: ObjectType):
Promise<InstanceElement | undefined> => {
  const brand = getParent(brandTheme)
  const brandLogoLink = brandTheme.value.logo
  if (brandLogoLink === undefined) {
    return undefined
  }

  const logoContent = await getLogoContent(brandLogoLink)
  if (logoContent === undefined) {
    return undefined
  }
  const name = 'brandLogo'
  const pathName = pathNaclCase(name)
  const resourcePathName = `${normalizeFilePathPart(name)}.png`
  const logoId = extractIdFromUrl(brandLogoLink)
  const logo = new InstanceElement(
    name,
    brandLogoType,
    {
      id: logoId,
      fileName: `${name}.png`,
      content: new StaticFile({
        filepath: `${OKTA}/${brandLogoType.elemID.name}/${resourcePathName}`,
        content: logoContent,
      }),
    },
    [OKTA, RECORDS_PATH, BRAND_LOGO_TYPE_NAME, pathName],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brandTheme.elemID, brandTheme),
        new ReferenceExpression(brand.elemID, brand)],
    }
  )
  return logo
}

const deployBrandLogo = async (
  client: OktaClient,
  logoInstance: InstanceElement,
  fileContent: Buffer | undefined,
): Promise<Error | void> => {
  try {
    const brandTheme = getParents(logoInstance)[0].value
    const brand = getParents(logoInstance)[1].value
    const logoUrl = `/api/v1/brands/${brand.value.id}/themes/${brandTheme.value.id}/logo`
    const form = new FormData()
    form.append('file', fileContent || Buffer.from(''), logoInstance.value.fileName)
    await client.post({
      url: logoUrl,
      data: form,
      headers: { ...form.getHeaders() },
    })
    return undefined
  } catch (err) {
    return getOktaError(logoInstance.elemID, err)
  }
}

const brandLogoFilter: FilterCreator = ({ client }) => ({
  name: 'brandLogoFilter',
  onFetch: async elements => {
    const brandTheme = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === BRAND_THEME_TYPE_NAME)

    if (brandTheme.length === 0) {
      log.debug('No apps with logo found')
    }
    const brandLogoType = createBrandLogoType()
    elements.push(brandLogoType)
    const brandLogoInstances = (await Promise.all(brandTheme.map(async theme => getBrandLogo(theme, brandLogoType))))
      .filter(isInstanceElement)
    brandLogoInstances.forEach(logo => elements.push(logo))
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [appLogoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BRAND_LOGO_TYPE_NAME,
    )
    const deployLogoResults = await Promise.all(appLogoChanges.map(async change => {
      const logoInstance = getChangeData(change)
      const fileContent = isAdditionOrModificationChange(change)
        && isStaticFile(logoInstance.value.content)
        ? await logoInstance.value.content.getContent()
        : undefined
      const deployResult = await deployBrandLogo(client, logoInstance, fileContent)
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
  },
})

export default brandLogoFilter
