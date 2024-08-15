/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { getChangeData, InstanceElement, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { isCustomFieldName, isDataObjectType, removeCustomFieldPrefix } from '../types'
import { PLATFORM_CORE_NAME, PLATFORM_CORE_NULL_FIELD_LIST } from '../client/suiteapp_client/constants'

const { awu } = collections.asynciterable

const filterCreator: LocalFilterCreator = () => ({
  name: 'dataInstancesNullFields',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .filter(async change => isDataObjectType(await getChangeData<InstanceElement>(change).getType()))
      .forEach(async change => {
        const nullFields = _(change.data.before.value)
          .keys()
          .filter(key => change.data.after.value[key] === undefined)
          .map(key => (isCustomFieldName(key) ? removeCustomFieldPrefix(key) : key))
          .value()
        if (!_.isEmpty(nullFields)) {
          change.data.after.value[PLATFORM_CORE_NULL_FIELD_LIST] = {
            [PLATFORM_CORE_NAME]: nullFields,
          }
        }
      })
  },
})

export default filterCreator
