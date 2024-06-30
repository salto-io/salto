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

import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { TYPE_NAME_TO_USER_FIELDS } from '../../filters/groups_and_users_filter'
import { validateValue } from './generic'

/**
 * AdjustFunction that runs upon fetch and change user references structure
 * so object type will be aligned with the structure yield by "groups_and_users_filter".
 */
export const createAdjustUserReferences: (typeName: string) => definitions.AdjustFunction = typeName => args => {
  const value = validateValue(args.value)
  const userFields = TYPE_NAME_TO_USER_FIELDS[typeName]
  userFields.forEach(field => {
    value[field] = {
      accountId: value[field],
      displayName: value[field],
    }
  })
  return { ...args, value }
}

/**
 * AdjustFunction that runs upon deploy and change user references structure to fit deploy api
 */
export const createAdjustUserReferencesReverse: (
  typeName: string,
) => definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = typeName => args => {
  const value = validateValue(args.value)
  const userFields = TYPE_NAME_TO_USER_FIELDS[typeName]
  userFields.forEach(field => {
    value[field] = _.get(value, `${field}.accountId`)
  })
  return { ...args, value }
}
