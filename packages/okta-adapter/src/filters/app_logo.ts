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
import Joi from 'joi'
import {
  Change,
  ElemID,
  InstanceElement,
  ObjectType,
  SaltoError,
  getChangeData,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createSchemeGuardForInstance } from '@salto-io/adapter-utils'
import {
  client as clientUtils,
  definitions as definitionsUtils,
  fetch as fetchUtils,
} from '@salto-io/adapter-components'
import { APPLICATION_TYPE_NAME, APP_LOGO_TYPE_NAME, LINKS_FIELD } from '../constants'
import { FilterCreator } from '../filter'
import { createFileType, deployLogo, getLogo } from '../logo'
import { deployChanges } from '../deployment'
import OktaClient from '../client/client'

const log = logger(module)
/* Allowed types by okta docs https://help.okta.com/en-us/Content/Topics/Apps/apps-customize-logo.htm */
const ALLOWED_LOGO_FILE_TYPES = new Set(['png', 'jpg', 'gif'])

type App = InstanceElement & {
  value: {
    id: string
    label: string
    _links: {
      logo: [
        {
          href: string
          type: string
          name: string
        },
      ]
    }
  }
}
const EXPECTED_APP_SCHEMA = Joi.object({
  id: Joi.string().required(),
  label: Joi.string().required(),
  _links: Joi.object({
    logo: Joi.array().items(
      Joi.object({
        href: Joi.string().required(),
        type: Joi.string().required(),
        name: Joi.string().required(),
      })
        .unknown(true)
        .required(),
    ),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isAppInstance = createSchemeGuardForInstance<App>(EXPECTED_APP_SCHEMA, 'Received invalid response for app values')

const getLogoFileType = (contentType: string): string | undefined => {
  const contentTypeParts = contentType.split('/')
  const fileType = contentTypeParts[contentTypeParts.length - 1]
  if (!ALLOWED_LOGO_FILE_TYPES.has(fileType)) {
    log.warn(`App logo content type ${contentType} is not supported`)
    return undefined
  }
  return fileType
}

const getAppLogo = async ({
  client,
  app,
  appLogoType,
  elemIDFunc,
}: {
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface
  app: InstanceElement
  appLogoType: ObjectType
  elemIDFunc: fetchUtils.element.ElemIDCreator
}): Promise<InstanceElement | Error> => {
  const appLogo = app.value[LINKS_FIELD].logo[0]
  const logoLink = appLogo.href

  const name = elemIDFunc({ entry: app.value, defaultName: app.elemID.name })
  const contentType = getLogoFileType(appLogo.type)
  if (contentType === undefined) {
    return new Error(`Failed to find content type for ${app.elemID.name}`)
  }
  return getLogo({
    client: client as OktaClient,
    parents: [app],
    logoType: appLogoType,
    contentType,
    logoName: name,
    link: logoLink,
    nestedPath: app.path?.slice(2, app.path?.length - 1) ?? [],
  })
}

/**
 * Fetches and deploys application's logos as static files.
 */
const appLogoFilter: FilterCreator = ({ definitions, getElemIdFunc }) => ({
  name: 'appLogoFilter',
  onFetch: async elements => {
    const client = definitions.clients.options.main.httpClient
    const appsWithLogo = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .filter(instance => isAppInstance(instance))
    const appLogoType = createFileType(APP_LOGO_TYPE_NAME)
    elements.push(appLogoType)

    const elemIDDef = definitionsUtils.queryWithDefault(definitions.fetch?.instances ?? {}).query(APPLICATION_TYPE_NAME)
      ?.element?.topLevel?.elemID
    if (elemIDDef === undefined) {
      log.error('Could not find elemID definition for %s, skipping appLogoFilter', APPLICATION_TYPE_NAME)
      return undefined
    }
    const elemIDFunc = fetchUtils.element.createElemIDFunc<never>({
      elemIDDef,
      typeID: new ElemID('okta', APPLICATION_TYPE_NAME),
      getElemIdFunc,
    })
    const allInstances = await Promise.all(
      appsWithLogo.map(async app => getAppLogo({ client, app, appLogoType, elemIDFunc })),
    )

    const [errors, appLogoInstances] = _.partition(allInstances, _.isError)
    appLogoInstances.forEach(logo => elements.push(logo))
    const fetchError: SaltoError[] = errors.map(err => ({
      message: `Failed to fetch App logo. ${err.message}`,
      severity: 'Warning',
    }))
    return { errors: fetchError }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const client = definitions.clients.options.main.httpClient
    const [appLogoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === APP_LOGO_TYPE_NAME,
    )

    const deployResult = await deployChanges(appLogoChanges, async change => deployLogo(change, client as OktaClient))

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default appLogoFilter
