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
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ResponseValue } from '../http_connection'
import { ClientBaseParams, HTTPReadClientInterface } from '../http_client'

const { isDefined } = lowerdashValues

type RecursiveQueryArgFunc = Record<string, (entry: ResponseValue) => string>

export type ClientGetWithPaginationParams = ClientBaseParams & {
  recursiveQueryParams?: RecursiveQueryArgFunc
  paginationField?: string
  pageSizeArgName?: string
}

export type PageEntriesExtractor = (page: ResponseValue) => ResponseValue[]
export type GetAllItemsFunc = (args: {
  client: HTTPReadClientInterface
  pageSize: number
  getParams: ClientGetWithPaginationParams
}) => AsyncIterable<ResponseValue[]>

export type PaginationFunc = ({
  responseData,
  page,
  pageSize,
  getParams,
  currentParams,
  responseHeaders,
}: {
  responseData: unknown
  page: ResponseValue[]
  pageSize: number
  getParams: ClientGetWithPaginationParams
  currentParams: Record<string, string>
  responseHeaders?: unknown
}) => Record<string, string>[]

export type PaginationFuncCreator<T = {}> = (
  args: {
    client: HTTPReadClientInterface
    pageSize: number
    getParams: ClientGetWithPaginationParams
  } & T,
) => PaginationFunc

/**
 * Helper function for generating individual recursive queries based on past responses.
 *
 * For example, the endpoint /folder may have an optional parent_id parameter that is called
 * to list the folders under parent_id. So for each item returned from /folder, we should make
 * a subsequent call to /folder?parent_id=<id>
 */
export const computeRecursiveArgs = (
  responses: ResponseValue[],
  recursiveQueryParams?: RecursiveQueryArgFunc,
): Record<string, string>[] =>
  recursiveQueryParams !== undefined && Object.keys(recursiveQueryParams).length > 0
    ? responses
        .map(res =>
          _.pickBy(
            _.mapValues(recursiveQueryParams, mapper => mapper(res)),
            isDefined,
          ),
        )
        .filter(args => Object.keys(args).length > 0)
    : []

export type Paginator = (
  params: ClientGetWithPaginationParams,
  extractPageEntries: PageEntriesExtractor,
) => AsyncIterable<ResponseValue[]>
