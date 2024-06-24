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
import { filters as filterUtils } from '@salto-io/adapter-components'
import { FilterAdditionalParams, FilterCreator, FilterResult } from '../filter'
import { OktaOptions } from '../definitions/types'
import { getOktaError } from '../deployment'
import { getLookUpNameCreator, OktaFieldReferenceResolver } from '../reference_mapping'
import { USER_TYPE_NAME } from '../constants'
import { OktaUserConfig } from '../user_config'

const filterCreator: FilterCreator = filterUtils.defaultDeployFilterCreator<
  FilterResult,
  OktaOptions,
  OktaUserConfig,
  FilterAdditionalParams
>({
  convertError: getOktaError,
  lookupFuncCreator: opts =>
    getLookUpNameCreator({
      enableMissingReferences: opts.config.fetch.enableMissingReferences,
      isUserTypeIncluded: opts.fetchQuery.isTypeMatch(USER_TYPE_NAME),
    }),
  fieldReferenceResolverCreator: OktaFieldReferenceResolver.create,
})

export default filterCreator
