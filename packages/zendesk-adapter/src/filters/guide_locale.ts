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
import Joi from 'joi'
import {
  BuiltinTypes, ElemID, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { ZENDESK } from '../constants'
import ZendeskClient from '../client/client'
import { FETCH_CONFIG } from '../config'

const log = logger(module)

const { RECORDS_PATH, TYPES_PATH } = elementsUtils

export const LOCALE_TYPE_NAME = 'guide_locale'

type LocalesResponse = {
  locales: string[]
  // eslint-disable-next-line camelcase
  default_locale: string
}

const EXPECTED_LOCALES_SCHEMA = Joi.object({
  locales: Joi.array().items(Joi.string().required()).required(),
  default_locale: Joi.string().required(),
}).required()

const isLocalesResponse = createSchemeGuard<LocalesResponse>(EXPECTED_LOCALES_SCHEMA, 'Received invalid guide locales result')

const getLocales = async (
  client: ZendeskClient,
): Promise<LocalesResponse | undefined> => {
  const response = await client.getSinglePage({
    url: '/api/v2/help_center/locales',
  })
  if (!isLocalesResponse(response.data)) {
    log.error('Failed to get the guide locales')
    return undefined
  }
  return response.data
}

/**
 * Adds the hardcoded channel instances in order to add references to them
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    if (!config[FETCH_CONFIG].enableGuide) {
      return
    }
    const localesRes = await getLocales(client)
    if (localesRes === undefined) {
      return
    }
    const localeType = new ObjectType({
      elemID: new ElemID(ZENDESK, LOCALE_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        default: { refType: BuiltinTypes.BOOLEAN },
      },
      path: [ZENDESK, TYPES_PATH, LOCALE_TYPE_NAME],
    })
    const defaultLocale = localesRes.default_locale
    const locales = localesRes.locales.map(locale => {
      const localeName = naclCase(locale)
      return new InstanceElement(
        localeName,
        localeType,
        { id: locale, default: locale === defaultLocale },
        [ZENDESK, RECORDS_PATH, LOCALE_TYPE_NAME, pathNaclCase(localeName)],
      )
    })
    const localeTypeFullID = localeType.elemID.getFullName()
    // the type was added already as part of addRemainingTypes. this will be fixed in SALTO-2869
    _.remove(elements, e => e.elemID.getFullName() === localeTypeFullID)
    elements.push(localeType)
    locales.forEach(locale => {
      elements.push(locale)
    })
  },
})

export default filterCreator
