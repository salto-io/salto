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
  InstanceElement, isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { detailedCompare, getPath } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isInstanceOfTypeChange } from './utils'
import {
  INSTANCE_FULL_NAME_FIELD,
  LABEL,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from '../constants'
import { apiName } from '../transformers/transformer'

export const LOGIN_IP_RANGES_FIELD = 'loginIpRanges'
export const LAYOUT_ASSIGNMENTS_FIELD = 'layoutAssignments'

const { awu, keyByAsync } = collections.asynciterable
const { isDefined } = values

const isRelatedChange = async (change: Change): Promise<boolean> => (
  isInstanceOfTypeChange(PERMISSION_SET_METADATA_TYPE, PROFILE_METADATA_TYPE)(change)
)

const toMinifiedChange = async (
  change: Change<InstanceElement>,
): Promise<Change<InstanceElement>> => {
  const [before, after] = getAllChangeData(change)
  const detailedChanges = detailedCompare(before, after, { createFieldChanges: true })
  const minifiedAfter = after.clone()
  minifiedAfter.value = (await apiName(before) === PROFILE_METADATA_TYPE) ? {
    [INSTANCE_FULL_NAME_FIELD]: after.value[INSTANCE_FULL_NAME_FIELD],
    [LOGIN_IP_RANGES_FIELD]: after.value[LOGIN_IP_RANGES_FIELD] ?? [],
  } : {
    [INSTANCE_FULL_NAME_FIELD]: after.value[INSTANCE_FULL_NAME_FIELD],
    [LABEL]: after.value[LABEL],
  }

  const newLayoutAssignmentNames: string[] = []
  detailedChanges
    .filter(isAdditionOrModificationChange)
    .forEach(detailedChange => {
      const changePath = getPath(before, detailedChange.id)
      if (_.isUndefined(changePath)) {
        return
      }
      if (changePath.includes(LAYOUT_ASSIGNMENTS_FIELD)) {
        newLayoutAssignmentNames.push(changePath[changePath.length - 1])
        return
      }
      const minifiedValuePath = changePath.length > 2
        ? changePath.slice(0, -1)
        : changePath
      const afterChange = _.get(after, minifiedValuePath)
      if (isDefined(afterChange)) {
        _.set(minifiedAfter, minifiedValuePath, afterChange)
      }
    })

  if (newLayoutAssignmentNames.length > 0) {
    minifiedAfter.value[LAYOUT_ASSIGNMENTS_FIELD] = _.pick(
      after.value[LAYOUT_ASSIGNMENTS_FIELD],
      newLayoutAssignmentNames,
    )
  }
  return toChange({
    before,
    after: minifiedAfter,
  })
}

const filterCreator: LocalFilterCreator = () => {
  let originalChanges: Record<string, Change>
  return {
    preDeploy: async changes => {
      const relatedChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isRelatedChange)
        .toArray()
      originalChanges = await keyByAsync(relatedChanges,
        change => apiName(getChangeData(change)))

      _.pullAll(changes, relatedChanges)
      changes.push(...(await Promise.all(relatedChanges.map(toMinifiedChange))))
    },
    onDeploy: async changes => {
      const appliedChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isRelatedChange)
        .toArray()
      const appliedChangesApiNames = await awu(appliedChanges)
        .map(change => apiName(getChangeData(change)))
        .toArray()

      const appliedOriginalChanges = appliedChangesApiNames
        .map(name => originalChanges[name])
        .filter(isDefined)

      _.pullAll(changes, appliedChanges)
      appliedOriginalChanges.forEach(change => changes.push(change))
    },
  }
}

export default filterCreator
