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
import { isInstanceOfType } from './utils'
import {
  INSTANCE_FULL_NAME_FIELD,
  INSTANCE_LABEL_FIELD,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from '../constants'
import { apiName } from '../transformers/transformer'

const isInstanceOfTypeProfile = isInstanceOfType(PROFILE_METADATA_TYPE)

export const LOGIN_IP_RANGES_FIELD = 'loginIpRanges'
export const LAYOUT_ASSIGNMENTS_FIELD = 'layoutAssignments'


const { awu, keyByAsync } = collections.asynciterable
const { isDefined } = values

const isProfileRelatedChange = async (change: Change): Promise<boolean> => (
  isInstanceOfTypeProfile(getChangeData(change))
)

const isPermissionSetRelatedChange = async (change: Change): Promise<boolean> => (
  isInstanceOfType(PERMISSION_SET_METADATA_TYPE)(getChangeData(change))
)

const toMinifiedProfileChange = (
  change: Change<InstanceElement>,
): Change<InstanceElement> => {
  const [before, after] = getAllChangeData(change)
  const detailedChanges = detailedCompare(before, after, { createFieldChanges: true })
  const minifiedAfter = after.clone()
  minifiedAfter.value = {
    [INSTANCE_FULL_NAME_FIELD]: after.value[INSTANCE_FULL_NAME_FIELD],
    [LOGIN_IP_RANGES_FIELD]: after.value[LOGIN_IP_RANGES_FIELD] ?? [],
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
      //  This code makes sure we deploy the whole parent value
      //  of nested attributes (for example, a change in userPermissions)
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
    before, // We don't really care about the before instance.
    after: minifiedAfter,
  })
}

const toMinifiedPermissionSetChange = (
  change: Change<InstanceElement>,
): Change<InstanceElement> => {
  const [before, after] = getAllChangeData(change)
  const detailedChanges = detailedCompare(before, after, { createFieldChanges: true })
  const minifiedAfter = after.clone()
  minifiedAfter.value = {
    [INSTANCE_FULL_NAME_FIELD]: after.value[INSTANCE_FULL_NAME_FIELD],
    [INSTANCE_LABEL_FIELD]: after.value[INSTANCE_LABEL_FIELD],
  }
  detailedChanges
    .filter(isAdditionOrModificationChange)
    .forEach(detailedChange => {
      const changePath = getPath(before, detailedChange.id)
      if (_.isUndefined(changePath)) {
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

  return toChange({
    before,
    after: minifiedAfter,
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
      const permissionSetChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isPermissionSetRelatedChange)
        .toArray()
      originalChanges = await keyByAsync([...profileChanges, ...permissionSetChanges],
        change => apiName(getChangeData(change)))

      _.pullAll(changes, [...profileChanges, ...permissionSetChanges])
      changes.push(...profileChanges.map(toMinifiedProfileChange),
        ...permissionSetChanges.map(toMinifiedPermissionSetChange))
    },
    onDeploy: async changes => {
      const appliedProfileChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isProfileRelatedChange)
        .toArray()
      const appliedPermissionSetChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isModificationChange)
        .filter(isPermissionSetRelatedChange)
        .toArray()
      const appliedChanges = [...appliedProfileChanges, ...appliedPermissionSetChanges]
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
