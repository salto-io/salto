/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { ElemID, InstanceElement, Value, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, setPath, walkOnElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { SCRIPT_ID } from '../constants'

const { awu } = collections.asynciterable

const getScriptIdsUnderLists = (instance: InstanceElement): Map<string, { elemID: ElemID; val: Value }> => {
  const pathToScriptIds = new Map<string, { elemID: ElemID; val: Value }>()
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (_.isPlainObject(value) && SCRIPT_ID in value && !path.isTopLevel()) {
        pathToScriptIds.set(path.getFullName(), { elemID: path, val: value })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return pathToScriptIds
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'restoreDeletedListItems',
  onDeploy: async changes => {
    await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .forEach(async instanceChange => {
        const before = getScriptIdsUnderLists(instanceChange.data.before)
        const after = getScriptIdsUnderLists(instanceChange.data.after)
        before.forEach((value, key) => {
          if (!after.has(key)) {
            setPath(instanceChange.data.after, value.elemID, value.val)
          }
        })
      })
  },
})

export default filterCreator
