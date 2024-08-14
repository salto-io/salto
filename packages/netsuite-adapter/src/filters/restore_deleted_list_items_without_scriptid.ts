/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ModificationChange, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { setPath } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { getGettersByType, getRemovedItemsRecord } from '../change_validators/remove_list_item_without_scriptid'

const addBeforeValuesToAfter = (instanceChange: ModificationChange<InstanceElement>): void => {
  const getters = getGettersByType(instanceChange.data.before.elemID.typeName)
  const { before, after } = instanceChange.data
  if (getters === undefined || _.get(before.value, getters.getListPath()) === undefined) {
    return
  }
  const listPath = getters.getListPath()
  if (_.get(after.value, listPath) === undefined) {
    setPath(after, after.elemID.createNestedID(...listPath), _.get(before.value, listPath))
  } else {
    const removedItems = getRemovedItemsRecord(instanceChange, getters)
    Object.assign(_.get(after.value, listPath), removedItems)
  }
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'restoreDeletedListItemsWithoutScriptId',
  onDeploy: async changes => {
    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .forEach(instanceChange => {
        addBeforeValuesToAfter(instanceChange)
      })
  },
})

export default filterCreator
