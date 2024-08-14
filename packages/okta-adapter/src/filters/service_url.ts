/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filters } from '@salto-io/adapter-components'
import { FilterAdditionalParams, FilterCreator, FilterResult } from '../filter'
import { OktaOptions } from '../definitions/types'
import { OktaUserConfig } from '../user_config'

const filter: FilterCreator = params =>
  filters.serviceUrlFilterCreator<OktaUserConfig, FilterResult, FilterAdditionalParams, OktaOptions>()(params)

export default filter
