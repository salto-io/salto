/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData, isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../../filter'

const filterCreator: LocalFilterCreator = () => ({
  name: 'suiteAppInternalIds',
  onDeploy: async (changes, { elemIdToInternalId = {} }) => {
    changes
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(element => element.elemID.getFullName() in elemIdToInternalId)
      .forEach(element => {
        element.value.internalId = elemIdToInternalId[element.elemID.getFullName()]
      })
  },
})

export default filterCreator
