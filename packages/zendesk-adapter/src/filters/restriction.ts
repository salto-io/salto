/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceElement, Element, Values } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

export const RESTRICTION_FIELD_NAME = 'restriction'

const removeIdField = (instanceValue: Values): void => {
  if (!_.isEmpty(instanceValue[RESTRICTION_FIELD_NAME]?.ids)) {
    delete instanceValue[RESTRICTION_FIELD_NAME].id
  }
}

/**
 * Fix the restriction object on multiple types
 */
const filterCreator: FilterCreator = () => ({
  name: 'restrictionFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    instances
      .filter(inst => ['view', 'macro'].includes(inst.elemID.typeName))
      .map(inst => inst.value)
      .forEach(removeIdField)
    instances
      .filter(instance => instance.elemID.typeName === 'workspace')
      .forEach(instance => {
        ;((instance.value.selected_macros as Values[]) ?? []).forEach(removeIdField)
      })
  },
})

export default filterCreator
