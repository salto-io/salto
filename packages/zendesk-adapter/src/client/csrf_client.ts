/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { get, isEmpty } from 'lodash'
import ZendeskClient from './client'

const log = logger(module)

export default class ZendeskCsrfClient extends ZendeskClient {
  private csrfToken?: string

  static createFromZendeskClient(client: ZendeskClient): ZendeskCsrfClient {
    // Create a new object with ZendeskCsrfClient's prototype
    const subInstance = Object.create(ZendeskCsrfClient.prototype)
    // Copy properties from the ZendeskClient to the new subInstance
    Object.assign(subInstance, client)
    return subInstance
  }

  async getCsrfToken(): Promise<string> {
    const res = await this.get({ url: '/api/v2/users/me' })
    const meData = res.data
    const xCsrfToken = get(meData, 'user.authenticity_token', '')
    if (isEmpty(xCsrfToken)) {
      throw new Error('Failed to get CSRF token')
    }
    return xCsrfToken
  }

  protected async sendRequest<T extends keyof clientUtils.HttpMethodToClientParams>(
    method: T,
    params: clientUtils.HttpMethodToClientParams[T] & { body?: unknown; data?: unknown },
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    if (method !== 'post') {
      return super.sendRequest(method, params)
    }
    if (this.csrfToken === undefined) {
      this.csrfToken = await this.getCsrfToken()
    }
    const headers = {
      ...params.headers,
      'Content-Type': 'application/json',
      'X-CSRF-Token': this.csrfToken,
    }
    if (params.body) {
      params.data = params.body
      delete params.body
    }
    try {
      return await super.sendRequest(method, { ...params, headers })
    } catch (e) {
      if (e.response?.status === 400) {
        log.debug('Got 400, trying to get new CSRF token')
        this.csrfToken = await this.getCsrfToken()
        return super.sendRequest(method, { ...params, headers: { 'X-CSRF-Token': this.csrfToken } })
      }
      throw e
    }
  }
}
