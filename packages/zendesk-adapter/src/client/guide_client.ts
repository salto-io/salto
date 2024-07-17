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

import { client } from '@salto-io/adapter-components'
import _ from 'lodash'
import ZendeskClient from './client'

type returnType = Promise<client.Response<client.ResponseValue | client.ResponseValue[]>>
const emptyRes: client.Response<client.ResponseValue | client.ResponseValue[]> = {
  data: [],
  status: 404,
}

export default class ZendeskGuideClient implements client.HTTPReadClientInterface, client.HTTPWriteClientInterface {
  private clientList: Record<string, ZendeskClient>
  constructor(clientList: Record<string, ZendeskClient>) {
    this.clientList = clientList
  }

  delete(params: client.ClientDataParams): returnType {
    // if (this.clientList[params.brandName] === undefined) {throw new Error(`delete failed as there is no client for brand ${params.brandName}`)}
    return this.clientList[0].delete(params)
  }

  async get(params: client.ClientBaseParams): returnType {
    const brandId = params.queryParams?.myCustomArgForBrandId
    if (!_.isString(brandId) || this.clientList[brandId] === undefined) {
      return emptyRes
    }
    const newParams = _.omit(params, 'queryParams.myCustomArgForBrandId')
    // if (this.clientList[params.brandName] === undefined) {throw new Error(`get failed as there is no client for brand ${params.brandName}`)}
    return this.clientList[brandId].get(newParams)
  }

  // eslint-disable-next-line class-methods-use-this
  getPageSize(): number {
    return 0
  }

  head(params: client.ClientBaseParams): returnType {
    // if (this.clientList[params.brandName] === undefined) {throw new Error(`head failed as there is no client for brand ${params.brandName}`)}
    return this.clientList[0].head(params)
  }

  options(params: client.ClientBaseParams): returnType {
    // if (this.clientList[params.brandName] === undefined) {throw new Error(`options failed as there is no client for brand ${params.brandName}`)}
    return this.clientList[0].options(params)
  }

  patch(params: client.ClientDataParams): returnType {
    // if (this.clientList[params.brandName] === undefined) {throw new Error(`patch failed as there is no client for brand ${params.brandName}`)}
    return this.clientList[0].patch(params)
  }

  post(params: client.ClientDataParams): returnType {
    // if (this.clientList[params.brandName] === undefined) {throw new Error(`post failed as there is no client for brand ${params.brandName}`)}
    return this.clientList[0].post(params)
  }

  put(params: client.ClientDataParams): returnType {
    // if (this.clientList[params.brandName] === undefined) {throw new Error(`put failed as there is no client for brand ${params.brandName}`)}
    return this.clientList[0].put(params)
  }
}
