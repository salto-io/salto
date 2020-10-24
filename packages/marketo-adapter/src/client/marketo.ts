/*
*                      Copyright 2020 Salto Labs Ltd.
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
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios'
import axiosRetry from 'axios-retry'
import { EventEmitter } from 'events'
import { Attribute, Credentials, Identity } from './types'

export type MarketoClientOpts = {
  credentials: Credentials
  connection?: Connection
}

export default interface Connection {
  auth: AuthAPI
  leads: MarketoObjectAPI
  opportunities: MarketoObjectAPI
  customObjects: MarketoObjectAPI
}

export interface RequestOptions {
  id?: string | number
  method?: string
  path?: string
  body?: {[key: string]: string | number}
  qs?: {[key: string]: string | number}
}

export interface AuthAPI extends MarketoObjectAPI {
  refreshAccessToken(): Promise<Identity>
}

export interface MarketoObjectAPI {
  getAll?<T>(options?: RequestOptions): Promise<T>
  create?<T>(options?: RequestOptions): Promise<T>
  delete?<T>(options?: RequestOptions): Promise<T>
  update?<T>(options?: RequestOptions): Promise<T>
  describe?<T>(options?: RequestOptions): Promise<T>
}

type MarketoResponse<T> = {
  requestId: string
  moreResult: boolean
  nextPageToken: string
  result: T
  success: boolean
  errors: {code: string; message: string}[]
  warnings: {code: string; message: string}[]
}

abstract class Base implements MarketoObjectAPI {
  protected client: Marketo

  constructor(client: Marketo) {
    this.client = client
  }

  getAll<T>(options: RequestOptions): Promise<T> {
    return this.request<T>(options, 'GET')
  }

  describe<T>(options: RequestOptions): Promise<T> {
    return this.request<T>(options, 'GET')
  }

  create<T>(options: RequestOptions): Promise<T> {
    return this.request<T>(options, 'POST')
  }

  delete<T>(options: RequestOptions): Promise<T> {
    return this.request(options, 'DELETE')
  }

  update<T>(options: RequestOptions): Promise<T> {
    return this.request(options, 'PUT')
  }

  private async request<T>(options: RequestOptions, method: string): Promise<T> {
    return this.client.apiRequest<T>(
      _.assign({ method }, options)
    )
  }
}

class Auth extends Base implements AuthAPI {
  async refreshAccessToken(): Promise<Identity> {
    return this.client.refreshAccessToken({
      method: 'GET',
      path: '/identity/oauth/token',
      qs: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        client_id: this.client.credentials.clientId,
        // eslint-disable-next-line @typescript-eslint/camelcase
        client_secret: this.client.credentials.clientSecret,
        // eslint-disable-next-line @typescript-eslint/camelcase
        grant_type: 'client_credentials',
      },
    })
  }

  isAccessTokenValid(): boolean {
    if (_.isUndefined(this.client.credentials.identity)) {
      return false
    }
    return Date.now() < this.client.credentials.identity.expires_in
  }

  getAccessToken(): string {
    if (_.isUndefined(this.client.credentials.identity)) {
      throw new Error('Missing identity')
    }
    return this.client.credentials.identity?.access_token
  }
}

class Lead extends Base implements MarketoObjectAPI {
  describe<T = Attribute[]>(): Promise<T> {
    return super.describe<T>({
      path: '/rest/v1/leads/describe.json',
    })
  }
}

class Opportunity extends Base implements MarketoObjectAPI {
  describe<T = Attribute[]>(): Promise<T> {
    return super.describe<T>({
      path: '/rest/v1/opportunities/describe.json',
    })
  }
}

class CustomObject extends Base implements MarketoObjectAPI {
  getAll<T = CustomObject[]>(): Promise<T> {
    return super.getAll({
      path: '/rest/v1/customobjects.json',
    })
  }

  describe<T = CustomObject>(options: RequestOptions): Promise<T> {
    if (!options.qs) {
      throw new Error('aa')
    }
    return super.describe<T>({
      path: `/rest/v1/customobjects/${options.qs.name}/describe.json`,
    })
  }
}

export class Marketo extends EventEmitter implements Connection {
  public credentials: Credentials
  private readonly api: AxiosInstance

  readonly auth: Auth
  readonly leads: Lead
  readonly opportunities: Opportunity
  readonly customObjects: CustomObject

  constructor(credentials: Credentials) {
    super()
    this.credentials = credentials

    this.auth = new Auth(this)
    this.leads = new Lead(this)
    this.opportunities = new Opportunity(this)
    this.customObjects = new CustomObject(this)

    this.api = axios.create({
      baseURL: this.credentials.endpoint,
    })
    axiosRetry(this.api, { retries: 3, retryDelay: axiosRetry.exponentialDelay })
  }

  async apiRequest<T>(requestOptions: RequestOptions): Promise<T> {
    if (!this.auth.isAccessTokenValid()) {
      await this.refreshAccessToken()
    }

    const config: AxiosRequestConfig = {
      url: requestOptions.path,
      headers: {
        Authorization: `Bearer ${this.auth.getAccessToken()}`,
      },
      method: requestOptions.method as Method,
      params: requestOptions.qs,
      data: requestOptions.body,
    }

    const response = await this.api.request<MarketoResponse<T>>(config)
    return Marketo.success<T>(response).result
  }

  async refreshAccessToken(requestOptions?: RequestOptions): Promise<Identity> {
    if (_.isUndefined(requestOptions)) {
      return this.auth.refreshAccessToken()
    }

    const config: AxiosRequestConfig = {
      url: requestOptions.path,
      method: requestOptions.method as Method,
      params: requestOptions.qs,
      data: requestOptions.body,
    }

    const startTime = Date.now()
    const response = await this.api.request<Identity>(config)
    if (_.isUndefined(response.data)) {
      throw new Error('Failed to refresh access token')
    }

    this.credentials.identity = {
      ...response.data,
      // eslint-disable-next-line @typescript-eslint/camelcase
      expires_in: startTime + response.data.expires_in,
    }
    return this.credentials.identity
  }

  static success<T>(response: AxiosResponse<MarketoResponse<T>>): MarketoResponse<T> {
    Marketo.validateResponse<T>(response)
    return response.data
  }

  static validateResponse<T>(response: AxiosResponse<MarketoResponse<T>>): void {
    if (response.status !== 200) {
      throw new Error(`Request failed with status code ${response.status}`)
    }
    if (_.has(response, ['data', 'success'])
      && !response.data.success
      && _.has(response, ['data', 'errors'])) {
      const errorMessages = response.data.errors
        .map((err: {code: string; message: string}) => err.message)
        .join('\n')
      throw new Error(errorMessages)
    }
  }
}
