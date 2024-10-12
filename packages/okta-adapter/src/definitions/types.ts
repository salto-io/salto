/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export type StatusActionName = 'activate' | 'deactivate'
export type AdditionalAction = StatusActionName
export type ClientOptions = 'main' | 'private'
type PaginationOptions = 'cursorHeader' | 'cursor' | 'limitedCursorHeader'
export type OktaOptions = {
  clientOptions: ClientOptions
  paginationOptions: PaginationOptions
  additionalAction: AdditionalAction
}
