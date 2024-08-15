/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FIELD_CONTEXT_OPTION_TYPE_NAME } from '../filters/fields/constants'

const log = logger(module)
export const isRelatedToSpecifiedTerms = (instance: InstanceElement, terms: string[]): boolean => {
  const includesTerm = (term: string): boolean => instance.value.type?.includes(term)

  if (terms.some(includesTerm)) {
    log.debug(`Found a field related to specified term in ${instance.elemID.getFullName()}.`)
    return true
  }
  return false
}

export const getContextParent = (instance: InstanceElement): InstanceElement => {
  let parent = getParent(instance)
  if (parent.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME) {
    parent = getParent(parent)
  }
  return parent
}

export const getContextAndFieldIds = (change: Change<InstanceElement>): { contextId: string; fieldId: string } => {
  const parent = getContextParent(getChangeData(change))
  return {
    contextId: parent.value.id,
    fieldId: getParent(parent).value.id,
  }
}
