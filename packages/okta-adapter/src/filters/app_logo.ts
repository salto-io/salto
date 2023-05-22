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

import { BuiltinTypes, CORE_ANNOTATIONS, Change, ElemID, InstanceElement, ObjectType, ReferenceExpression, SaltoError, StaticFile, getChangeData, isAdditionOrModificationChange, isInstanceElement, isStaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { getParent, naclCase, normalizeFilePathPart, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import FormData from 'form-data'
import Joi from 'joi'
import { OktaConfig } from '../config'
import { getOktaError } from '../deployment'
import { extractIdFromUrl } from '../utils'
import { APPLICATION_TYPE_NAME, APP_LOGO_TYPE_NAME, OKTA, LINKS_FIELD } from '../constants'
import { FilterCreator } from '../filter'
import OktaClient from '../client/client'
import { getLogoContent } from './logo'

const log = logger(module)
const { getInstanceName, TYPES_PATH, SUBTYPES_PATH, RECORDS_PATH } = elementsUtils
/* Allowed types by okta docs https://help.okta.com/en-us/Content/Topics/Apps/apps-customize-logo.htm */
const ALLOWED_LOGO_FILE_TYPES = new Set(['png', 'jpg', 'gif'])


type App = {
  id: string
  label: string
  _links: {
  logo: [{
    href: string
    type: string
    name: string
    }]
  }
}
const EXPECTED_APP_SCHEMA = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().required(),
  _links: Joi.object({
    logo: Joi.array().items(Joi.object({
      href: Joi.string().required(),
      type: Joi.string().required(),
      name: Joi.string().required(),
    }).required()),
  }).required(),
}).required()

const isApp = (value: unknown): value is App => {
  const { error } = EXPECTED_APP_SCHEMA.validate(value, { allowUnknown: true })
  if (error !== undefined) {
    log.error('Recieved invalid response for the app values')
    return false
  }
  return true
}
const createAppLogoType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(OKTA, APP_LOGO_TYPE_NAME),
    fields: {
      id: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      fileName: { refType: BuiltinTypes.STRING },
      contentType: { refType: BuiltinTypes.STRING },
      content: { refType: BuiltinTypes.STRING },
    },
    path: [OKTA, TYPES_PATH, SUBTYPES_PATH, APP_LOGO_TYPE_NAME, APP_LOGO_TYPE_NAME],
  })

const getLogoFileType = (contentType: string): string | undefined => {
  const contentTypeParts = contentType.split('/')
  const fileType = contentTypeParts[contentTypeParts.length - 1]
  if (!ALLOWED_LOGO_FILE_TYPES.has(fileType)) {
    log.debug(`App logo content type ${contentType} is not supported`)
    return undefined
  }
  return fileType
}

const getAppLogo = async (app: InstanceElement, appLogoType: ObjectType, config: OktaConfig,
): Promise<InstanceElement | undefined> => {
  if (!isApp(app.value)) {
    log.debug(`App ${app.value.label} is not a valid app`)
    return undefined
  }
  const appLogo = app.value[LINKS_FIELD]?.logo[0]
  if (appLogo === undefined) {
    return undefined
  }
  const logoLink = appLogo.href
  if (logoLink === undefined) {
    log.debug(`App ${app.value.label} does not have a logo link`)
    return undefined
  }

  const logoContent = await getLogoContent(logoLink)
  const idField = config.apiDefinitions.types[APPLICATION_TYPE_NAME]?.transformation?.idFields
  if (idField === undefined || logoContent === undefined) {
    return undefined
  }
  const appName = naclCase(getInstanceName(app.value, idField, APP_LOGO_TYPE_NAME))
  const pathName = pathNaclCase(appName)
  const resourcePathName = `${normalizeFilePathPart(appName)}.${getLogoFileType(appLogo.type)}`
  const logoId = extractIdFromUrl(logoLink)
  if (logoId === undefined) {
    log.debug(`App ${app.value.label} does not have a logo id`)
  }
  const logo = new InstanceElement(
    appName,
    appLogoType,
    {
      id: logoId ?? app.value.id,
      fileName: `${appLogo.name}.${getLogoFileType(appLogo.type)}`,
      contentType: appLogo.type,
      content: new StaticFile({
        filepath: `${OKTA}/${appLogoType.elemID.name}/${resourcePathName}`,
        content: logoContent,
      }),
    },
    [OKTA, RECORDS_PATH, APP_LOGO_TYPE_NAME, pathName],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app)],
    }
  )
  return logo
}

const deployAppLogo = async (
  client: OktaClient,
  logoInstance: InstanceElement,
  fileContent: Buffer | undefined,
): Promise<Error | void> => {
  try {
    const appId = getParent(logoInstance).value.id
    const logoUrl = `/api/v1/apps/${appId}/logo`
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

/**
 * Fetches and deploys application's logos as static files.
 */
const appLogoFilter: FilterCreator = ({ client, config }) => ({
  name: 'appLogoFilter',
  onFetch: async elements => {
    const appsWithLogo = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === APPLICATION_TYPE_NAME)
      .filter(app => app.value[LINKS_FIELD]?.logo !== undefined)
    const appLogoType = createAppLogoType()
    elements.push(appLogoType)
    const [warnings, appLogoInstances] = _.partition((await Promise.all(appsWithLogo
      .map(async app => getAppLogo(app, appLogoType, config))))
      .filter(isInstanceElement), app => app === undefined)
    appLogoInstances.forEach(logo => elements.push(logo))

    const saltoWarnings = warnings.map((app: InstanceElement): SaltoError => ({
      message: `App ${app.value.label} does not have a propper logo`,
      severity: 'Warning',
    }))
    return { errors: saltoWarnings }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [appLogoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === APP_LOGO_TYPE_NAME,
    )

    const deployLogoResults = await Promise.all(appLogoChanges.map(async change => {
      const logoInstance = getChangeData(change)
      const fileContent = isAdditionOrModificationChange(change)
        && isStaticFile(logoInstance.value.content)
        ? await logoInstance.value.content.getContent()
        : undefined
      const deployResult = await deployAppLogo(client, logoInstance, fileContent)
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

export default appLogoFilter
