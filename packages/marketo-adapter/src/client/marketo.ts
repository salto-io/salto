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
import { Credentials, Identity } from './types'

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
  getAll<T>(options: RequestOptions): Promise<T>
  create<T>(options: RequestOptions): Promise<T>
  delete<T>(options: RequestOptions): Promise<T>
  update<T>(options: RequestOptions): Promise<T>
  describe<T>(options: RequestOptions): Promise<T>
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

  async getAll<T>(options: RequestOptions): Promise<T> {
    return this.apiRequest<T>({ ...options, method: 'GET' })
  }

  async describe<T>(options: RequestOptions): Promise<T> {
    return this.apiRequest<T>({ ...options, method: 'GET' })
  }

  async create<T>(options: RequestOptions): Promise<T> {
    return this.apiRequest<T>({ ...options, method: 'POST' })
  }

  async update<T>(options: RequestOptions): Promise<T> {
    return this.apiRequest<T>({ ...options, method: 'PUT' })
  }

  async delete<T>(options: RequestOptions): Promise<T> {
    return this.apiRequest<T>({ ...options, method: 'DELETE' })
  }

  async apiRequest<T>(requestOptions: RequestOptions): Promise<T> {
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

    const response = await this.api.request<MarketoResponse<T>>(config)
    return Marketo.success<T>(response).result
  }

  private isAccessTokenValid(): boolean {
    if (this.credentials.identity === undefined) {
      return false
    }
    return Date.now() < this.credentials.identity.expires_in
  }

  private getAccessToken(): string {
    if (this.credentials.identity !== undefined) {
      return this.credentials.identity.access_token
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
    const response = await this.api.request<Identity>(config)
    if (response.data === undefined) {
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
