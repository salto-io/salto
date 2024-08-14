/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { Options } from '../types'

const log = logger(module)

export const PAGINATION: definitions.ApiDefinitions<Options>['pagination'] = {
  increasePageUntilEmpty: {
    funcCreator:
      () =>
      ({ responseData, currentParams }) => {
        if (!('results' in responseData)) {
          log.error('increasePageUntilEmpty pagination error: No results in response data')
          return []
        }
        const { results } = responseData
        if (!Array.isArray(results)) {
          log.error('increasePageUntilEmpty pagination error: Results is not an array')
          return []
        }
        if (results.length === 0) {
          return []
        }
        return [
          _.merge({}, currentParams, {
            queryParams: {
              page: (Number(currentParams.queryParams?.page ?? 0) + 1).toString(),
            },
          }),
        ]
      },
  },
}
