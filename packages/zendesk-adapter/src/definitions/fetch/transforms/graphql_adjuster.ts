/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { get } from 'lodash'

// this transformer extracts the data from the graphql response
export const transform: (innerRoot: string) => definitions.AdjustFunctionMulti =
  (innerRoot: string) =>
  async ({ value }) => {
    if (!lowerdashValues.isPlainObject(value)) {
      throw new Error('unexpected value for graphql item, not transforming')
    }
    const graphqlValues = get(value, `data.${innerRoot}`)
    return graphqlValues === undefined
      ? { value }
      : graphqlValues.map((graphqlValue: Record<string, unknown>) => ({
          value: {
            ...graphqlValue,
          },
        }))
  }
