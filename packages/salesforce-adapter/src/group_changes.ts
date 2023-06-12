/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import {
  Change,
  ChangeGroupIdFunction,
  getChangeData,
  InstanceElement,
  ChangeGroupId,
  ChangeId,
  isAdditionChange, isInstanceChange, ObjectType, isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { apiName } from './transformers/transformer'
import { isInstanceOfCustomObjectChange } from './custom_object_instances_deploy'
import { FIELD_ANNOTATIONS } from './constants'
import { safeApiName } from './filters/utils'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const log = logger(module)

type ChangeGroupDescription = {
  groupId: string
  disjoint?: boolean
}

type ChangeIdFunction<
    T extends Change = Change
> = (change: T) => Promise<ChangeGroupDescription> | ChangeGroupDescription

const hasReferenceToSameType = async (type: ObjectType): Promise<boolean> => {
  const typeName = await safeApiName(type)
  return awu(Object.values(type.fields))
    .flatMap(field => makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]))
    .filter(isReferenceExpression)
    .some(async ref => typeName === await safeApiName(await ref.getResolvedValue()))
}

const shouldDisjointChange = async (change: Change<InstanceElement>): Promise<boolean> => {
  if (!isAdditionChange(change)) {
    return false
  }
  if (await hasReferenceToSameType(await getChangeData(change).getType())) {
    log.debug('Not disjointing change with id %s because it has a reference to the same type')
    return false
  }
  return true
}

const instanceOfCustomObjectChangeToGroupId: ChangeIdFunction<Change<InstanceElement>> = async change => ({
  groupId: `${change.action}_${await apiName(await (getChangeData(change) as InstanceElement).getType())}_instances`,
  // CustomObjects instances might have references to instances of the same type (via Lookup
  // fields), and if we deploy them together the reference gets removed.
  disjoint: await shouldDisjointChange(change),
})

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const changeGroupIdMap = new Map<ChangeId, ChangeGroupId>()
  const disjointGroups = new Set<ChangeGroupId>()

  await awu(changes.entries()).forEach(async ([changeId, change]) => {
    const { groupId, disjoint = undefined } = isInstanceChange(change) && await isInstanceOfCustomObjectChange(change)
      ? await instanceOfCustomObjectChangeToGroupId(change)
    // Everything that is not a custom object instance goes into the deploy api
      : { groupId: 'salesforce_metadata' }

    changeGroupIdMap.set(changeId, groupId)
    if (disjoint) {
      disjointGroups.add(groupId)
    }
  })

  return { changeGroupIdMap, disjointGroups }
}
