/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Values } from '@salto-io/adapter-api'
import { Credentials, Identity, MarketoError, MarketoResponse } from './types'

export type MarketoClientOpts = {
  credentials: Credentials
  connection?: MarketoObjectAPI
}

type RestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestOptions {
  id?: string | number
  method?: RestMethod
  path?: string
  body?: {[key: string]: string | number}
  qs?: {[key: string]: string | number}
}

export interface MarketoObjectAPI {
  refreshAccessToken(): Promise<Identity>
  getAll(options: RequestOptions): Promise<Values[]>
  create(options: RequestOptions): Promise<Values[]>
  delete(options: RequestOptions): Promise<Values[]>
  update(options: RequestOptions): Promise<Values[]>
  describe(options: RequestOptions): Promise<Values[]>
}

export class Marketo extends EventEmitter implements MarketoObjectAPI {
  public credentials: Credentials
  private readonly api: AxiosInstance

  constructor(credentials: Credentials) {
    super()
    this.credentials = credentials
    this.api = axios.create({
      baseURL: this.credentials.endpoint,
    })
    axiosRetry(this.api, { retries: 3, retryDelay: axiosRetry.exponentialDelay })
  }

  async getAll(options: RequestOptions): Promise<Values[]> {
    return this.apiRequest({ ...options, method: 'GET' })
  }

  async describe(options: RequestOptions): Promise<Values[]> {
    return this.apiRequest({ ...options, method: 'GET' })
  }

  async create(options: RequestOptions): Promise<Values[]> {
    return this.apiRequest({ ...options, method: 'POST' })
  }

  async update(options: RequestOptions): Promise<Values[]> {
    return this.apiRequest({ ...options, method: 'PUT' })
  }

  async delete(options: RequestOptions): Promise<Values[]> {
    return this.apiRequest({ ...options, method: 'DELETE' })
  }

  async apiRequest(requestOptions: RequestOptions): Promise<Values[]> {
    if (!this.isAccessTokenValid()) {
      await this.refreshAccessToken()
    }

    const config: AxiosRequestConfig = {
      url: requestOptions.path,
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      method: requestOptions.method as Method,
      params: requestOptions.qs,
      data: requestOptions.body,
    }

    const response = await this.api.request(config) as AxiosResponse<MarketoResponse>
    return Marketo.success(response).result
  }

  private isAccessTokenValid(): boolean {
    if (this.credentials.identity === undefined) {
      return false
    }
    return Date.now() < this.credentials.identity.expiresIn
  }

  private getAccessToken(): string {
    if (this.credentials.identity !== undefined) {
      return this.credentials.identity.accessToken
    }
    throw new Error('Missing identity')
  }

  async refreshAccessToken(): Promise<Identity> {
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: '/identity/oauth/token',
      params: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        client_id: this.credentials.clientId,
        // eslint-disable-next-line @typescript-eslint/camelcase
        client_secret: this.credentials.clientSecret,
        // eslint-disable-next-line @typescript-eslint/camelcase
        grant_type: 'client_credentials',
      },
    }

    //  Start time is taken before request to avoid edge cases
    const startTime = Date.now()
    const response = await this.api.request(config) as AxiosResponse<{
      access_token: string
      scope: string
      expires_in: number
      token_type: string
    }>
    if (response.data === undefined) {
      throw new Error('Failed to refresh access token')
    }

    this.credentials.identity = {
      accessToken: response.data.access_token,
      scope: response.data.scope,
      expiresIn: startTime + response.data.expires_in,
      tokenType: response.data.token_type,
    }
    return this.credentials.identity
  }

  static success(response: AxiosResponse<MarketoResponse>): MarketoResponse {
    Marketo.validateResponse(response)
    return response.data
  }

  static validateResponse(response: AxiosResponse<MarketoResponse>): void {
    if (response.status !== 200) {
      throw new Error(`Request failed with status code ${response.status}`)
    }
    if (_.has(response, ['data', 'success'])
      && !response.data.success
      && _.has(response, ['data', 'errors'])) {
      const errorMessages = response.data.errors
        .map((err: MarketoError) => err.message)
        .join('\n')
      throw new Error(errorMessages)
    }
  }
}
