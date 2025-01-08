/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import _ from 'lodash'
import {
  getChangeData,
  isModificationChange,
  InstanceElement,
  isInstanceChange,
  ModificationChange,
  ElemID,
  ChangeError,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { SCRIPT_ID } from '../constants'
import { NetsuiteChangeValidator } from './types'
import { getMessageByElementNameAndListItems } from './remove_list_item_without_scriptid'

const { awu } = collections.asynciterable

const getScriptIdsUnderLists = async (
  instance: InstanceElement,
): Promise<collections.map.DefaultMap<string, Set<string>>> => {
  const pathToScriptIds = new collections.map.DefaultMap<string, Set<string>>(() => new Set())
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (_.isPlainObject(value) && SCRIPT_ID in value && !path.isTopLevel()) {
        pathToScriptIds.get(path.getFullName()).add(value.scriptid)
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return pathToScriptIds
}

const getRemovedListItems = async (
  change: ModificationChange<InstanceElement>,
): Promise<{
  removedListItems: string[]
  elemID: ElemID
}> => {
  const idsUnderListsBefore = await getScriptIdsUnderLists(change.data.before)
  const idsUnderListsAfter = await getScriptIdsUnderLists(change.data.after)
  const removedListItems = wu(idsUnderListsBefore.entries())
    .map(([path, beforeIds]) => wu(beforeIds).filter(beforeId => !idsUnderListsAfter.get(path).has(beforeId)))
    .flatten()
    .toArray()
  return { removedListItems, elemID: getChangeData(change).elemID }
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const instanceChanges = (await awu(changes)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .toArray()) as ModificationChange<InstanceElement>[]

  return awu(instanceChanges)
    .map(getRemovedListItems)
    .filter(({ removedListItems }: { removedListItems: string[] }) => !_.isEmpty(removedListItems))
    .map(({ elemID, removedListItems }: { removedListItems: string[]; elemID: ElemID }) => ({
      elemID,
      severity: 'Warning',
      message: 'Inner Element Removal Not Supported',
      detailedMessage: getMessageByElementNameAndListItems('element', removedListItems),
    }))
    .toArray() as Promise<ChangeError[]>
}

export default changeValidator
