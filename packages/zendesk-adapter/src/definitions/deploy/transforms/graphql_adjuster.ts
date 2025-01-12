/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { get } from 'lodash'
import { transform as transformMulti } from '../../fetch/transforms/graphql_adjuster'

// this transformer creates a graphql request from a mutation/query, operation name and variable names
// the variable names are used to extract the values from the item's value
export const transformRequest: (
  mutation: string,
  operationName: string,
  variableNames: string[],
) => definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> =
  (mutation, operationName, variableNames) =>
  async ({ value }) => {
    if (!lowerdashValues.isPlainObject(value)) {
      throw new Error('unexpected value for graphql item, not transforming')
    }
    return {
      value: {
        query: mutation,
        operationName,
        variables: variableNames.reduce((acc: Record<string, string>, variableName: string) => {
          acc[variableName] = get(value, variableName)
          return acc
        }, {}),
      },
    }
  }

// this transformer extracts the data from a graphql response,
// it assumes the data is the first and only element in the data array
export const transformResponse: (
  innerRoot: string,
) => definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = innerRoot => async item => {
  const value = await transformMulti(innerRoot)(item)
  if (value.length !== 1) {
    throw new Error(`unexpected response amount for graphql item, not transforming: ${safeJsonStringify(value)}`)
  }
  return { value: value[0].value }
}
