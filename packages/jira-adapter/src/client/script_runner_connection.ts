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
import Joi from 'joi'
import axios from 'axios'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { client as clientUtils, config } from '@salto-io/adapter-components'
import { HTMLElement, parse } from 'node-html-parser'
import JiraClient from './client'
import { ScriptRunnerCredentials } from '../auth'

const log = logger(module)
const { AdapterFetchError } = config

const SURVEY_TITLE = 'Post Install Complete'

type TokenAddressResponse = {
  url: string
}

const TOKEN_ADDRESS_RESPONSE_SCHEME = Joi.object({
  url: Joi.string().required(),
}).unknown(true)

const isTokenAddressResponse = createSchemeGuard<TokenAddressResponse>(
  TOKEN_ADDRESS_RESPONSE_SCHEME,
  'Failed to get scriptRunner token from jira service',
)

type TokenResponse = {
  data: string
}

const TOKEN_RESPONSE_SCHEME = Joi.object({
  data: Joi.string().required(),
}).unknown(true)

const isTokenResponse = createSchemeGuard<TokenResponse>(
  TOKEN_RESPONSE_SCHEME,
  'Failed to get scriptRunner token from scriptRunner service',
)

const isSurveyScreen = (root: HTMLElement): boolean => root.querySelector('title')?.text === SURVEY_TITLE

const getSurveyUrl = (baseUrl: string): string =>
  `${baseUrl}plugins/servlet/ac/com.onresolve.jira.groovy.groovyrunner/post-install-nav-link`

const getLoginError = (): Error =>
  new AdapterFetchError(
    'Failed to get ScriptRunner token, the response from the jira service was not as expected. Please try again later. Our support team was notified about this, and we will investigate it as well.',
    'Error',
  )

const getUrlFromService = async (jiraClient: JiraClient): Promise<string> => {
  const jiraResponse = await jiraClient.get({
    url: '/plugins/servlet/ac/com.onresolve.jira.groovy.groovyrunner/scriptrunner-home?classifier=json&s=com.onresolve.jira.groovy.groovyrunner__scriptrunner-home',
  })
  if (!isTokenAddressResponse(jiraResponse.data)) {
    log.error('Failed to get scriptRunner token, the response from the jira service was not as expected')
    throw getLoginError()
  }
  try {
    // eslint-disable-next-line no-new
    new URL(jiraResponse.data.url)
  } catch (e) {
    log.error(
      'Failed to parse scriptRunner token, the response from the jira service was not a valid url',
      jiraResponse.data.url,
    )
    throw getLoginError()
  }
  return jiraResponse.data.url
}

const getBaseUrl = async (getUrl: Promise<string>): Promise<string> => new URL(await getUrl).origin

const getSrTokenFromHtml = (html: string, surveyUrl: string): string => {
  const root = parse(html)

  // Find the meta tag with name="sr-token"
  const srTokenElement = root.querySelector('meta[name="sr-token"]')
  if (srTokenElement === null) {
    log.error(
      'Failed to get scriptRunner token from scriptRunner service, could not find meta tag with name="sr-token"',
      html,
    )

    throw isSurveyScreen(root)
      ? new AdapterFetchError(
          `Fetch failed as ScriptRunner was not fully installed in the Jira Instance. To continue, please open the ScriptRunner app at ${surveyUrl}, fill and send the survey, and try again.`,
          'Error',
        )
      : getLoginError()
  }

  // Extract the content attribute value
  const srToken = srTokenElement.getAttribute('content')

  if (srToken === undefined) {
    log.error('Failed to get scriptRunner token from scriptRunner service, could not find content attribute"', html)
    throw getLoginError()
  }
  return srToken
}

const getJwtFromService = async (getUrl: Promise<string>, jiraUrl: string): Promise<string> => {
  const url = await getUrl
  const baseURL = await getBaseUrl(getUrl)
  const httpClient = axios.create({
    baseURL,
  })
  try {
    const srResponse = await httpClient.get(url.replace(baseURL, ''))
    if (!isTokenResponse(srResponse)) {
      log.error('Failed to get scriptRunner token from scriptRunner service', srResponse)
      throw getLoginError()
    }
    return getSrTokenFromHtml(srResponse.data, getSurveyUrl(jiraUrl))
  } catch (e) {
    if (e instanceof AdapterFetchError) {
      throw e
    }
    log.error('Failed to get scriptRunner token from scriptRunner service', e)
    throw getLoginError()
  }
}

export const createScriptRunnerConnection = (
  jiraClient: JiraClient,
  isDataCenter: boolean,
): clientUtils.ConnectionCreator<ScriptRunnerCredentials> => {
  let urlPromise: Promise<string> | undefined
  const getUrl = async (): Promise<string> => {
    if (isDataCenter) {
      return '' // Currently all the implementation is only for cloud
    }
    if (urlPromise === undefined) {
      urlPromise = getUrlFromService(jiraClient)
    }
    return urlPromise
  }

  return (retryOptions, timeout) =>
    clientUtils.axiosConnection({
      retryOptions,
      authParamsFunc: async _credentials => ({
        headers: {
          Authorization: `JWT ${await getJwtFromService(getUrl(), jiraClient.baseUrl)}`,
        },
      }),
      baseURLFunc: async _credentials => getBaseUrl(getUrl()),
      credValidateFunc: async () => ({ accountId: '' }), // There is no login endpoint to call
      timeout,
    })
}
