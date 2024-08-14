/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { client } from '@salto-io/adapter-components'
import _ from 'lodash'
import ZendeskClient from './client'

type returnType = Promise<client.Response<client.ResponseValue | client.ResponseValue[]>>
const emptyRes: client.Response<client.ResponseValue | client.ResponseValue[]> = {
  data: [],
  status: 404,
}

// we use this client to make zendesk guide calls, clientList is a record of brandId to zendeskClient. Each call that goes through this
// client will be diverted to the correct zendesk client according the brand ID received in the params.
export default class ZendeskGuideClient implements client.HTTPReadClientInterface, client.HTTPWriteClientInterface {
  private clientList: Record<string, ZendeskClient>
  constructor(clientList: Record<string, ZendeskClient>) {
    this.clientList = clientList
  }

  private async sendRequest(
    params: client.ClientDataParams,
    method: keyof client.HttpMethodToClientParams,
  ): returnType {
    const brandId = params.params?.brand?.id
    if (!_.isString(brandId)) {
      throw new Error(`${method} failed as brandId is not defined`)
    }
    // we shouldn't get guide elements for this brand
    if (this.clientList[brandId] === undefined) {
      return emptyRes
    }
    return this.clientList[brandId][method](params)
  }

  async delete(params: client.ClientDataParams): returnType {
    return this.sendRequest(params, 'delete')
  }

  async get(params: client.ClientBaseParams): returnType {
    return this.sendRequest(params, 'get')
  }

  // eslint-disable-next-line class-methods-use-this
  getPageSize(): number {
    return 0
  }

  async head(params: client.ClientBaseParams): returnType {
    return this.sendRequest(params, 'head')
  }

  async options(params: client.ClientBaseParams): returnType {
    return this.sendRequest(params, 'options')
  }

  async patch(params: client.ClientDataParams): returnType {
    return this.sendRequest(params, 'patch')
  }

  async post(params: client.ClientDataParams): returnType {
    return this.sendRequest(params, 'post')
  }

  async put(params: client.ClientDataParams): returnType {
    return this.sendRequest(params, 'put')
  }
}
