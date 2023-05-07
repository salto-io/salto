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

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import axios from 'axios'
import { naclCase, normalizeFilePathPart, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { extractIdFromUrl } from '../utils'
import { APPLICATION_TYPE_NAME, APP_LOGO_TYPE_NAME, OKTA } from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)
const LINKS_FIELD = '_links'
const { TYPES_PATH, SUBTYPES_PATH, RECORDS_PATH } = elementsUtils

const APP_LOGO_TYPE = new ObjectType({
  elemID: new ElemID(OKTA, APP_LOGO_TYPE_NAME),
  fields: {
    id: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    },
    filename: { refType: BuiltinTypes.STRING },
    contentType: { refType: BuiltinTypes.STRING },
    content: { refType: BuiltinTypes.STRING },
  },
  path: [OKTA, TYPES_PATH, SUBTYPES_PATH, APP_LOGO_TYPE_NAME, APP_LOGO_TYPE_NAME],
})

const getLogoContent = async (link: string,
): Promise<Buffer | undefined> => {
  const httpClient = axios.create({
    url: link,
  })
  const res = await httpClient.get(link, { responseType: 'arraybuffer' })
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error('Received invalid response from Zendesk API for attachment content')
    return undefined
  }
  return content
}

const getAppLogo = async (app: InstanceElement,
): Promise<InstanceElement | undefined> => {
  const appLogo = app.value[LINKS_FIELD]?.logo[0]
  const logoLink = appLogo.href
  if (logoLink === undefined) {
    return undefined
  }

  const logoContent = await getLogoContent(logoLink)
  if (logoContent === undefined) {
    return undefined
  }
  const appName = app.value.label
  const name = elementsUtils.ducktype.toNestedTypeName(
    appName, appLogo.name,
  )
  const naclName = naclCase(name)
  const pathName = pathNaclCase(naclName)
  const resourcePathName = `${normalizeFilePathPart(name)}.png`
  const logoId = extractIdFromUrl(logoLink)
  const logo = new InstanceElement(
    naclName,
    APP_LOGO_TYPE,
    {
      id: logoId,
      filename: appLogo.name,
      contentType: appLogo.type,
      content: new StaticFile({
        filepath: `${OKTA}/${APP_LOGO_TYPE.elemID.name}/${resourcePathName}`,
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

const appLogoFilter: FilterCreator = () => ({
  name: 'appLogoFilter',
  onFetch: async elements => {
    const appsWithLogo = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === APPLICATION_TYPE_NAME)
      .filter(app => app.value[LINKS_FIELD]?.logo !== undefined)
    elements.push(APP_LOGO_TYPE)
    const appLogoInstances = (await Promise.all(appsWithLogo.map(async app => getAppLogo(app))))
      .filter(isInstanceElement)
    appLogoInstances.forEach(logo => elements.push(logo))
  },
})

export default appLogoFilter
