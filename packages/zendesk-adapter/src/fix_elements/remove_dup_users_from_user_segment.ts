/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable no-console */

import { ChangeError, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { resolvePath } from '@salto-io/adapter-utils'
import { FixElementsHandler } from './types'
import { USER_SEGMENT_TYPE_NAME } from '../constants'
import { ValueReplacer } from '../replacers_utils'

const dupUsersRemovalWarning = (
  instance: InstanceElement,
  dupUsers: string[],
): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: `${dupUsers.length} username${dupUsers.length > 1 ? 's appear' : ' appears'} multiple times in the added_user_ids field and will be removed`,
  detailedMessage: `The following usernames appear multiple times in the added_user_ids field: ${dupUsers.join(', ')}.\nIf you continue, the duplicate entries will be removed from the list.\n`,
})

const replaceUserSegmentUserIDs: ValueReplacer = (instance, mapping) => {
  const fieldValuePath = instance.elemID.createNestedID('added_user_ids')
  if (mapping !== undefined) {
    instance.value.added_user_ids = Object.values(mapping)
  }
  const userIDs: string[] = instance.value.added_user_ids
  return userIDs.map((_value, i) => fieldValuePath.createNestedID(i.toString()))
}

const TYPE_NAME_TO_REPLACER_FOR_DUPES: Record<string, ValueReplacer> = {
  [USER_SEGMENT_TYPE_NAME]: replaceUserSegmentUserIDs,
}

const removeDupesFromAddedUserIDs =
  (instance: InstanceElement): undefined | { fixedInstance: InstanceElement; dupUsers: string[] } => {
    const userPaths = TYPE_NAME_TO_REPLACER_FOR_DUPES[instance.elemID.typeName]?.(instance)

    const addedUsers: string[] = userPaths    
      .map(path => resolvePath(instance, path))
      .filter(values.isDefined)

    const dupUsers = addedUsers.filter((item: string, index) => addedUsers.indexOf(item) !== index)
    if (_.isEmpty(dupUsers)) {
      return undefined
    }

    const newUsersMapping: Record<string, string> = {}
    addedUsers.forEach(user => { newUsersMapping[user] = user })

    const fixedInstance = instance.clone()
    TYPE_NAME_TO_REPLACER_FOR_DUPES[instance.elemID.typeName]?.(fixedInstance, newUsersMapping)
    return { fixedInstance, dupUsers }
  }

const isRelevantElement = (element: unknown): element is InstanceElement =>
  isInstanceElement(element) && Object.keys(TYPE_NAME_TO_REPLACER_FOR_DUPES).includes(element.elemID.typeName)

/**
 * This fixer makes sure that there are no duplicate users in the same field
 */
export const removeDupUsersFromUserSegmentHandler: FixElementsHandler =
  () =>
  async elements => {
    const fixedElementsWithUserCount = elements
      .filter(isRelevantElement)
      .map(removeDupesFromAddedUserIDs)
      .filter(values.isDefined)

    const errors = fixedElementsWithUserCount.map(({ fixedInstance, dupUsers }) =>
      dupUsersRemovalWarning(fixedInstance, dupUsers),
    )
    return { 
      fixedElements: fixedElementsWithUserCount.map(({ fixedInstance }) => fixedInstance), 
      errors,
    }
  }
