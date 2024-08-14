/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { AdapterOperations, ChangeValidator } from '@salto-io/adapter-api'

export const getAdapterChangeValidators = (
  adapters: Record<string, AdapterOperations>,
  checkOnly: boolean,
): Record<string, ChangeValidator> =>
  _(adapters)
    .mapValues(adapter =>
      checkOnly ? adapter.validationModifiers?.changeValidator : adapter.deployModifiers?.changeValidator,
    )
    .pickBy(values.isDefined)
    .value()
