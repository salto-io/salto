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
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import {
  Change, ChangeValidator, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange,
  isInstanceChange, isInstanceElement, isModificationChange, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { TICKET_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME, ORG_FIELD_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

type ParentAndChildTypePair = { parent: string; child: string }
export const RELEVANT_PARENT_AND_CHILD_TYPES: ParentAndChildTypePair[] = [
  { parent: TICKET_FIELD_TYPE_NAME, child: 'ticket_field__custom_field_options' },
  { parent: USER_FIELD_TYPE_NAME, child: 'user_field__custom_field_options' },
  { parent: ORG_FIELD_TYPE_NAME, child: 'organization_field__custom_field_options' },
]

export const CHECKBOX_TYPE_NAME = 'checkbox'

export const isRelevantChange = (change: Change<InstanceElement>): boolean => {
  const instance = getChangeData(change)
  const changeTypeName = instance.elemID.typeName
  if (RELEVANT_PARENT_AND_CHILD_TYPES.some(pair => pair.parent === changeTypeName)) {
    return (instance.value.type === CHECKBOX_TYPE_NAME)
      && !(
        isModificationChange(change)
        && (change.data.before.value.tag === change.data.after.value.tag)
      )
      && !_.isEmpty(instance.value.tag)
  }
  if (RELEVANT_PARENT_AND_CHILD_TYPES.some(pair => pair.child === changeTypeName)) {
    return !(
      isModificationChange(change)
      && (change.data.before.value.value === change.data.after.value.value)
    )
  }
  return false
}

const getRelevantPairType = (change: Change<InstanceElement>):
ParentAndChildTypePair | undefined => {
  const { typeName } = getChangeData(change).elemID
  return RELEVANT_PARENT_AND_CHILD_TYPES.find(pair => [pair.parent, pair.child].includes(typeName))
}

const findConflictedInstances = ({
  instanceToCheck, relevantInstances, fieldName, value,
}: {
  instanceToCheck: InstanceElement
  relevantInstances: InstanceElement[]
  fieldName: string
  value: string
}): string[] => relevantInstances
  .filter(inst => inst.value[fieldName] === value)
  .filter(inst => inst.elemID.getFullName() !== instanceToCheck.elemID.getFullName())
  .map(inst => inst.elemID.getFullName())

const getConflictedIds = ({
  change, pair, childInstances, parentInstances,
}: {
  change: Change<InstanceElement>
  pair: ParentAndChildTypePair
  childInstances: InstanceElement[]
  parentInstances: InstanceElement[]
}): {instanceNames: string[]; tag: string} => {
  const instance = getChangeData(change)
  const value = instance.elemID.typeName === pair.parent
    ? instance.value.tag
    : instance.value.value
  const conflictedChildInstanceNames = findConflictedInstances({
    instanceToCheck: instance, relevantInstances: childInstances, fieldName: 'value', value,
  })
  const conflictedParentInstanceNames = findConflictedInstances({
    instanceToCheck: instance, relevantInstances: parentInstances, fieldName: 'tag', value,
  })
  return {
    instanceNames: [...conflictedChildInstanceNames, ...conflictedParentInstanceNames],
    tag: value,
  }
}

const getRelevantInstances = async ({
  relevantTypeToElementIds, typeName, elementSource, filter = (() => true),
}: {
  relevantTypeToElementIds: Record<string, ElemID[]>
  typeName: string
  elementSource: ReadOnlyElementsSource
  filter?: (instance: InstanceElement) => boolean
}): Promise<InstanceElement[]> => {
  const elementIds = relevantTypeToElementIds[typeName] ?? []
  return awu(elementIds)
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .filter(filter)
    .toArray()
}

export const duplicateCustomFieldOptionValuesValidator: ChangeValidator = async (
  changes, elementSource
) => {
  const relevantChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(isRelevantChange)
  if (_.isEmpty(relevantChanges) || (elementSource === undefined)) {
    return []
  }
  const relevantTypes = _.uniqBy(
    relevantChanges
      .map(getRelevantPairType)
      .filter(values.isDefined),
    pair => pair.parent,
  )
  const relevantTypeToElementIds = await awu(await elementSource.list())
    .filter(id => relevantTypes.flatMap(pair => [pair.parent, pair.child]).includes(id.typeName))
    .filter(id => id.idType === 'instance')
    .groupBy(id => id.typeName)
  return awu(relevantTypes).map(async pair => {
    const childInstances = await getRelevantInstances({
      relevantTypeToElementIds, typeName: pair.child, elementSource,
    })
    const parentInstances = await getRelevantInstances({
      relevantTypeToElementIds,
      typeName: pair.parent,
      elementSource,
      filter: inst => inst.value.type === CHECKBOX_TYPE_NAME && !_.isEmpty(inst.value.tag),
    })
    return relevantChanges
      .filter(change => getRelevantPairType(change)?.parent === pair.parent)
      .flatMap(change => {
        const instance = getChangeData(change)
        const conflictedInstanceNames = getConflictedIds({
          change, pair, childInstances, parentInstances,
        })
        if (conflictedInstanceNames.instanceNames.length > 0) {
          return [{
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot do this change since this tag value is already in use',
            detailedMessage: `The tag ‘${conflictedInstanceNames.tag}’ is already used by the following elements:
${conflictedInstanceNames.instanceNames.join(', ')}`,
          }]
        }
        return []
      })
  }).flat().toArray()
}
