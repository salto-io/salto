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

import _ from 'lodash'
import { FixElementsFunc } from '@salto-io/adapter-api'
import { customReferenceHandlers } from '../custom_references'
import { fallbackUsersHandler } from './fallback_user'
import { FixElementsArgs } from './types'
import { removeDupUsersHandler } from './remove_dup_users'
import { mergeListsHandler } from './merge_lists'

export const createFixElementFunctions = (args: FixElementsArgs): Record<string, FixElementsFunc> => ({
  ..._.mapValues(customReferenceHandlers, handler => handler.removeWeakReferences(args)),
  fallbackUsers: fallbackUsersHandler(args),
  mergeLists: mergeListsHandler(args),
  // removingDupes needs to be after fallbackUsers
  removeDupUsers: removeDupUsersHandler(args),
})
