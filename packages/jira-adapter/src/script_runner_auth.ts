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
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import JiraClient from './client/client'

const log = logger(module)

type TokenAddressResponse = {
  url: string
}

const TOKEN_ADDRESS_RESPONSE_SCHEME = Joi.object({
  url: Joi.string().required(),
}).unknown(true)

const isTokenAddressResponse = createSchemeGuard<TokenAddressResponse>(TOKEN_ADDRESS_RESPONSE_SCHEME, 'Failed to get script runner token from jira service')

export default class ScriptRunnerCredentials {
  urlPromise: Promise<string> | undefined
  readonly jiraClient: JiraClient

  constructor(jiraClient: JiraClient) {
    this.jiraClient = jiraClient
  }

  private async getUrlFromService(): Promise<string> {
    const jiraResponse = await this.jiraClient.getSinglePage({
      url: '/plugins/servlet/ac/com.onresolve.jira.groovy.groovyrunner/scriptrunner-home?classifier=json&s=com.onresolve.jira.groovy.groovyrunner__scriptrunner-home',
    })
    if (!isTokenAddressResponse(jiraResponse.data)) {
      log.error('Failed to get script runner token, the response from the jira service was not as expected')
      return ''
    }
    try {
      // eslint-disable-next-line no-new
      new URL(jiraResponse.data.url)
    } catch (e) {
      log.error('Failed to parse script runner token, the response from the jira service was not a valid url ', jiraResponse.data.url)
      return ''
    }
    return jiraResponse.data.url
  }

  public async getUrl(): Promise<string> {
    if (!this.urlPromise) {
      this.urlPromise = this.getUrlFromService()
    }
    return this.urlPromise
  }

  public async getBaseUrl(): Promise<string> {
    return new URL(await this.getUrl()).origin
  }
}
