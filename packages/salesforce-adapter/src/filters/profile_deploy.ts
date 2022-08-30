/*
*                      Copyright 2022 Salto Labs Ltd.
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
import {
  Change,
  getAllChangeData,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
// eslint-disable-next-line import/no-extraneous-dependencies,no-restricted-imports
import { getDiffInstance } from '@salto-io/core/dist/src/core/plan/diff'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { isInstanceOfType } from './utils'
import { PROFILE_METADATA_TYPE } from '../constants'
import { apiName } from '../transformers/transformer'

const isInstanceOfTypeProfile = isInstanceOfType(PROFILE_METADATA_TYPE)

const { awu, keyByAsync } = collections.asynciterable
const { isDefined } = values

const isProfileRelatedChange = async (change: Change): Promise<boolean> => (
  isInstanceOfTypeProfile(getChangeData(change))
)

const toMinifiedChange = (change: Change<InstanceElement>): Change<InstanceElement> => {
  const [before, after] = getAllChangeData(change)
  const minimalBefore = getDiffInstance(toChange({
    before: after,
    after: before,
  }))
  const minimalAfter = getDiffInstance(change)
  minimalBefore.value.fullName = before.value.fullName
  minimalAfter.value.fullName = after.value.fullName
  return toChange({
    before: minimalBefore,
    after: minimalAfter,
  })
}

const filterCreator: LocalFilterCreator = () => {
  let originalChanges: Record<string, Change>
  return {
    preDeploy: async changes => {
      const profileChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isProfileRelatedChange)
        .toArray()
      originalChanges = await keyByAsync(profileChanges, change => apiName(getChangeData(change)))

      _.pullAll(changes, profileChanges)
      changes.push(...profileChanges.map(toMinifiedChange))
    },
    onDeploy: async changes => {
      const appliedProfileChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isProfileRelatedChange)
        .toArray()
      const appliedProfileChangesApiNames = await awu(appliedProfileChanges)
        .map(change => apiName(getChangeData(change)))
        .toArray()

      const appliedOriginalChanges = appliedProfileChangesApiNames
        .map(name => originalChanges[name])
        .filter(isDefined)

      _.pullAll(changes, appliedProfileChanges)
      changes.push(...appliedOriginalChanges)
    },
  }
}

export default filterCreator
