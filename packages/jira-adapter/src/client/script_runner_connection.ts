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
import Joi from 'joi'
import axios from 'axios'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { client as clientUtils } from '@salto-io/adapter-components'
import { parse } from 'node-html-parser'
import JiraClient from './client'
import { ScriptRunnerCredentials } from '../auth'

const log = logger(module)

export class ScriptRunnerLoginError extends Error {
}

type TokenAddressResponse = {
  url: string
}

const TOKEN_ADDRESS_RESPONSE_SCHEME = Joi.object({
  url: Joi.string().required(),
}).unknown(true)

const isTokenAddressResponse = createSchemeGuard<TokenAddressResponse>(TOKEN_ADDRESS_RESPONSE_SCHEME, 'Failed to get script runner token from jira service')

type TokenResponse = {
  data: string
}

const TOKEN_RESPONSE_SCHEME = Joi.object({
  data: Joi.string().required(),
}).unknown(true)

const isTokenResponse = createSchemeGuard<TokenResponse>(TOKEN_RESPONSE_SCHEME, 'Failed to get script runner token from scriptRunner service')

const getUrlFromService = async (jiraClient: JiraClient): Promise<string> => {
  const jiraResponse = await jiraClient.getSinglePage({
    url: '/plugins/servlet/ac/com.onresolve.jira.groovy.groovyrunner/scriptrunner-home?classifier=json&s=com.onresolve.jira.groovy.groovyrunner__scriptrunner-home',
  })
  if (!isTokenAddressResponse(jiraResponse.data)) {
    log.error('Failed to get script runner token, the response from the jira service was not as expected')
    throw new ScriptRunnerLoginError('Failed to get script runner token, the response from the jira service was not as expected')
  }
  try {
    // eslint-disable-next-line no-new
    new URL(jiraResponse.data.url)
  } catch (e) {
    log.error('Failed to parse script runner token, the response from the jira service was not a valid url', jiraResponse.data.url)
    throw new ScriptRunnerLoginError('Failed to parse script runner token, the response from the jira service was not a valid url')
  }
  return jiraResponse.data.url
}

const getBaseUrl = async (getUrl: Promise<string>): Promise<string> =>
  new URL(await getUrl).origin


const getSrTokenFromHtml = (html: string): string => {
  const root = parse(html)

  // Find the meta tag with name="sr-token"
  const srTokenElement = root.querySelector('meta[name="sr-token"]')
  if (srTokenElement === null) {
    log.error('Failed to get script runner token from scriptRunner service, could not find meta tag with name="sr-token"')
    throw new ScriptRunnerLoginError('Failed to get script runner token from scriptRunner service, could not find meta tag with name="sr-token"')
  }

  // Extract the content attribute value
  const srToken = srTokenElement.getAttribute('content')

  if (srToken === undefined) {
    log.error('Failed to get script runner token from scriptRunner service, could not find content attribute"')
    throw new ScriptRunnerLoginError('Failed to get script runner token from scriptRunner service, could not find content attribute')
  }
  return srToken
}

const getJwtFromService = async (getUrl: Promise<string>): Promise<string> => {
  const url = await getUrl
  const baseURL = await getBaseUrl(getUrl)
  const httpClient = axios.create({
    baseURL,
  })
  try {
    const srResponse = await httpClient.get(url.replace(baseURL, ''),)
    if (!isTokenResponse(srResponse)) {
      log.error('Failed to get script runner token from scriptRunner service', srResponse)
      throw new ScriptRunnerLoginError('Failed to get script runner token from scriptRunner service')
    }
    return getSrTokenFromHtml(srResponse.data)
  } catch (e) {
    log.error('Failed to get script runner token from scriptRunner service', e)
    throw new ScriptRunnerLoginError('Failed to get script runner token from scriptRunner service')
  }
}

export const createScriptRunnerConnection = (
  jiraClient: JiraClient
): clientUtils.ConnectionCreator<ScriptRunnerCredentials> => {
  let urlPromise: Promise<string> | undefined
  const getUrl = async (): Promise<string> => {
    if (urlPromise === undefined) {
      urlPromise = getUrlFromService(jiraClient)
    }
    return urlPromise
  }

  return retryOptions => (
    clientUtils.axiosConnection({
      retryOptions,
      authParamsFunc: async _credentials => ({
        headers: {
          Authorization: `JWT ${await getJwtFromService(getUrl())}`,
        },
      }),
      baseURLFunc: async _credentials => getBaseUrl(getUrl()),
      credValidateFunc: async () => ({ accountId: '' }), // There is no login endpoint to call
    })
  )
}
