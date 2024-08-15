/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Change, getChangeData, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { IDENTIFIER_FIELD } from '../data_elements/types'
import { LocalFilterCreator } from '../filter'
import { isDataObjectType } from '../types'

const { awu } = collections.asynciterable

const filterCreator: LocalFilterCreator = () => ({
  name: 'dataInstancesIdentifiers',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(async change => isDataObjectType(await getChangeData<InstanceElement>(change).getType()))
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(change, element => {
          delete element.value[IDENTIFIER_FIELD]
          return element
        }),
      )
  },
})

export default filterCreator
