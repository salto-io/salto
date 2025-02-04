/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { isEmpty } from 'lodash'
import { transformGraphQLItem } from '.'
import { getFullLanguageName } from '../../shared/transforms/bot_adjuster'

const transformNodes = (nodes: unknown[] | undefined): void => {
  if (nodes) {
    nodes.forEach(node => {
      if (!lowerdashValues.isPlainRecord(node)) {
        throw new Error('unexpected value for graphql bot node, not transforming')
      }
      if (isEmpty(node?.externalId)) {
        // Element id is based on externalId
        node.externalId = node.id
      }
    })
  }
}

export const transform: definitions.AdjustFunctionMulti = async item => {
  const values = await transformGraphQLItem('flows')(item)
  return values.map(({ value }) => {
    if (value?.enabledLanguages) {
      value.enabledLanguages = value.enabledLanguages.map(getFullLanguageName)
    }
    ;(value?.subflows ?? []).forEach((answer: { nodes?: unknown[] }) => transformNodes(answer?.nodes))
    return { value }
  })
}
