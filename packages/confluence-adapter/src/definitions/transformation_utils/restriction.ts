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
import { definitions } from '@salto-io/adapter-components'
import { getChangeData, isEqualValues, isModificationChange } from '@salto-io/adapter-api'

export const DEFAULT_RESTRICTION = [
  {
    operation: 'update',
  },
]

/**
 * Check if need to modify restriction on added page
 * If restrictions are set to default no need to make another call as upon page addition it gets default restrictions
 */
export const shouldNotModifyRestrictionOnPageAddition = (args: definitions.deploy.ChangeAndContext): boolean => {
  const changeData = getChangeData(args.change).value
  const restriction = _.get(changeData, 'restriction')
  return _.isEqual(restriction, DEFAULT_RESTRICTION)
}

/**
 * Check if need to modify restriction on page modification
 * If user change page restriction to the default, we need to delete the existing restriction
 */
export const shouldDeleteRestrictionOnPageModification = (args: definitions.deploy.ChangeAndContext): boolean => {
  if (!isModificationChange(args.change)) {
    return false
  }
  const afterRestriction = _.get(args.change.data.after.value, 'restriction')
  if (isEqualValues(args.change.data.before.value.restriction, afterRestriction)) {
    return false
  }
  return isEqualValues(afterRestriction, DEFAULT_RESTRICTION)
}

/**
 * Update the restriction format and omit redundant fields
 */
export const adjustRestriction: definitions.AdjustFunction = ({ value }) => {
  const userRestrictions = _.get(value, 'restrictions.user.results')
  return {
    value: {
      operation: _.get(value, 'operation'),
      restrictions: {
        user: Array.isArray(userRestrictions)
          ? userRestrictions.map(user => _.omit(user, ['publicName', 'profilePicture', 'displayName']))
          : userRestrictions,
        group: _.get(value, 'restrictions.group.results'),
      },
    },
  }
}
