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
export { AdapterClientBase } from './base'
export { ClientBaseConfig, ClientRateLimitConfig, ClientPageSizeConfig, createClientConfigType, validateClientConfig } from './config'
export { DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } from './constants'
export { logDecorator, requiresLogin } from './decorators'
export { AdapterHTTPClient, ClientBaseParams, ClientDataParams, ClientOpts, HTTPReadClientInterface, HTTPWriteClientInterface, HTTPError, HttpMethodToClientParams } from './http_client'
export { axiosConnection, createClientConnection, createRetryOptions, validateCredentials, APIConnection, ConnectionCreator, Response, ResponseValue, UnauthorizedError, Connection, RetryOptions, AuthParams, AuthenticatedAPIConnection } from './http_connection'
export { createPaginator, getWithCursorPagination, getWithItemOffsetPagination as getWithItemIndexPagination, getWithPageOffsetPagination, getWithPageOffsetAndLastPagination, getWithOffsetAndLimit, traverseRequests } from './pagination/pagination'
export { ClientGetWithPaginationParams, GetAllItemsFunc, PageEntriesExtractor, PaginationFunc, PaginationFuncCreator, Paginator } from './pagination/common'
export { getAllPagesWithOffsetAndTotal } from './pagination/pagination_async'
export { createRateLimitersFromConfig, throttle, BottleneckBuckets } from './rate_limit'
