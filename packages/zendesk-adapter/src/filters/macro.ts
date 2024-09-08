/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { MACRO_TYPE_NAME } from '../constants'

/**
 * This filter adds the restriction field as null to a macro with no restriction field.
 */
const filterCreator: FilterCreator = () => ({
  name: 'macroFilter',
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === MACRO_TYPE_NAME)
      .filter(change => getChangeData(change).value.restriction === undefined)
      .forEach(change => {
        getChangeData(change).value.restriction = null
      })
  },
  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === MACRO_TYPE_NAME)
      .filter(change => getChangeData(change).value.restriction === null)
      .forEach(change => {
        delete getChangeData(change).value.restriction
      })
  },
})

export default filterCreator
