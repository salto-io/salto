/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { AdapterOperations, ChangeGroupIdFunction } from '@salto-io/adapter-api'

export const getAdapterChangeGroupIdFunctions = (
  adapters: Record<string, AdapterOperations>,
): Record<string, ChangeGroupIdFunction> =>
  _(adapters)
    .mapValues(adapter => adapter.deployModifiers?.getChangeGroupIds)
    .pickBy(values.isDefined)
    .value()
