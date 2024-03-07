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
import { logger } from '@salto-io/logging'
import OktaClient from './client/client'

const log = logger(module)

type OktaOrgResponse = {
  pipeline: string
}

const isOktaOrgResponse = (value: unknown): value is OktaOrgResponse => _.isObject(value) && 'pipeline' in value

/**
 * Determine if an account is Classic Engine Org or Okta Identity Engine Org
 */
export const isClassicEngineOrg = async (oktaClient: OktaClient): Promise<boolean> => {
  try {
    const { data } = await oktaClient.get({ url: '/.well-known/okta-organization' })
    if (!isOktaOrgResponse(data)) {
      log.debug('Recived invalid response when trying to determine org type')
      return false
    }
    // pipeline is idx for Okta Identity Engine, and v1 for Classic Engine
    return data.pipeline === 'v1'
  } catch (err) {
    log.debug('Failed to determine org type, defaults to Identity Engine Account')
    return false
  }
}

/**
 * Extract id from okta's _links object urls
 * Example url: https://subdomain.okta.com/api/v1/group/abc123
 */
export const extractIdFromUrl = (url: string): string | undefined => {
  if (url.includes('/')) {
    const urlParts = url.split('/')
    return urlParts.pop()
  }
  log.warn(`Failed to extract id from url: ${url}`)
  return undefined
}

export const validateOktaBaseUrl = (baseUrl: string): void => {
  // Okta's org url must be from one of the following formats:
  //   - Standard domain: companyname.okta.com
  //   - EMEA domain: companyname.okta-emea.com
  //   - Sandbox subdomain: companyname.oktapreview.com
  //   Source: https://developer.okta.com/docs/concepts/okta-organizations/
  //   Customized domains also works with the Okta domain (https://developer.okta.com/docs/guides/custom-url-domain/main/#about-okta-domain-customizations)
  if (!/^https:\/\/([a-zA-Z0-9.-]+\.(okta\.com|oktapreview\.com|okta-emea\.com|trexcloud\.com))(\/)?$/.test(baseUrl)) {
    log.error(`${baseUrl} is not a valid account url`)
    throw new Error('baseUrl is invalid')
  }
}
