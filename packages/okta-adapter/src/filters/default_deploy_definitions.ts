/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { filters as filterUtils } from '@salto-io/adapter-components'
import { FilterAdditionalParams, FilterCreator, FilterResult } from '../filter'
import { OktaOptions } from '../definitions/types'
import { getOktaError } from '../deprecated_deployment'
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
