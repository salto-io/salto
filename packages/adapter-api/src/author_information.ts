/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { Element } from './elements'
import { CORE_ANNOTATIONS } from './constants'

export type AuthorInformation = {
  changedBy?: string
  changedAt?: string
}

export const getAuthorInformation = (element: Element | undefined): AuthorInformation => {
  if (element === undefined) {
    return {}
  }
  return _.pickBy(
    {
      changedAt: element.annotations[CORE_ANNOTATIONS.CHANGED_AT],
      changedBy: element.annotations[CORE_ANNOTATIONS.CHANGED_BY],
    },
    values.isDefined,
  )
}
