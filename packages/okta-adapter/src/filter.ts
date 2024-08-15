/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { OldOktaDefinitionsConfig } from './config'
import { User } from './user_utils'
import { OktaOptions } from './definitions/types'
import { OktaUserConfig } from './user_config'

export const { filterRunner } = filterUtils

export type Filter = filterUtils.Filter<filterUtils.FilterResult>
export type FilterResult = filterUtils.FilterResult

export type FilterAdditionalParams = {
  fetchQuery: elementUtils.query.ElementQuery
  oldApiDefinitions: OldOktaDefinitionsConfig // TODO remove as part of SALTO-5692
  usersPromise?: Promise<User[]>
  paginator: clientUtils.Paginator
  baseUrl: string
  isOAuthLogin: boolean
}

export type FilterCreator = filterUtils.AdapterFilterCreator<
  OktaUserConfig,
  filterUtils.FilterResult,
  FilterAdditionalParams,
  OktaOptions
>
