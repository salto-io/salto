/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filters as filterUtils } from '@salto-io/adapter-components'
import { FilterAdditionalParams, FilterCreator, FilterResult } from '../filter'
import { Options } from '../definitions/types'
import { ZendeskUserConfig } from '../user_config'
import { lookupFunc, ZendeskFieldReferenceResolver } from './field_references'
import { getZendeskError } from '../errors'

const filterCreator: FilterCreator = filterUtils.defaultDeployFilterCreator<
  FilterResult,
  Options,
  ZendeskUserConfig,
  FilterAdditionalParams
>({
  convertError: getZendeskError,
  lookupFuncCreator: () => lookupFunc,
  fieldReferenceResolverCreator: ZendeskFieldReferenceResolver.create,
})

export default filterCreator
