/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
export { AdapterClientBase } from './base'
export {
  DEFAULT_RETRY_OPTS,
  DEFAULT_TIMEOUT_OPTS,
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  RATE_LIMIT_DEFAULT_RETRY_OPTIONS,
  RATE_LIMIT_DEFAULT_OPTIONS,
} from './constants'
export { logDecorator, requiresLogin } from './decorators'
export {
  AdapterHTTPClient,
  ClientBaseParams,
  ClientDataParams,
  ClientOpts,
  HTTPReadClientInterface,
  HTTPWriteClientInterface,
  HTTPError,
  HttpMethodToClientParams,
} from './http_client'
export {
  axiosConnection,
  createClientConnection,
  createRetryOptions,
  validateCredentials,
  APIConnection,
  ConnectionCreator,
  Response,
  ResponseValue,
  UnauthorizedError,
  Connection,
  RetryOptions,
  AuthParams,
  AuthenticatedAPIConnection,
} from './http_connection'
export {
  createPaginator,
  getWithCursorPagination,
  getWithItemOffsetPagination as getWithItemIndexPagination,
  getWithPageOffsetPagination,
  getWithPageOffsetAndLastPagination,
  getWithOffsetAndLimit,
  traverseRequests,
} from './pagination/pagination'
export {
  ClientGetWithPaginationParams,
  GetAllItemsFunc,
  PageEntriesExtractor,
  PaginationFunc,
  PaginationFuncCreator,
  Paginator,
} from './pagination/common'
export { getAllPagesWithOffsetAndTotal } from './pagination/pagination_async'
export { createRateLimitersFromConfig, throttle, RateLimitBuckets } from './rate_limit'
export { RateLimiter, RateLimiterCounters, RateLimiterOptions } from './rate_limiter'
export { createClient } from './client_creator'
export { executeWithPolling } from './polling'
