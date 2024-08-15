/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  isAdditionOrModificationChange,
  isInstanceChange,
  getChangeData,
  InstanceElement,
  Change,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { STATUS_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const RELEVANT_TYPES = [STATUS_TYPE_NAME]

const filter: FilterCreator = () => ({
  name: 'iconUrlFilter',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => RELEVANT_TYPES.includes(getChangeData(change).elemID.typeName))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
          instance.value.iconurl = instance.value.iconUrl
          delete instance.value.iconUrl
          return instance
        })
      })
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => RELEVANT_TYPES.includes(getChangeData(change).elemID.typeName))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
          instance.value.iconUrl = instance.value.iconurl
          delete instance.value.iconurl
          return instance
        })
      })
  },
})

export default filter
