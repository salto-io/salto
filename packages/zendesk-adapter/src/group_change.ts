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
import { values, collections } from '@salto-io/lowerdash'
import { Change, ChangeGroupIdFunction, getChangeData, ChangeGroupId, ChangeId,
  isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { SECTION_TYPE_NAME } from './filters/help_center_parent_to_section'

const { awu } = collections.asynciterable

type ChangeIdFunction = (change: Change) => Promise<string | undefined>

const PARENT_GROUPED_WITH_INNER_TYPE = [
  'ticket_field',
  'user_field',
  'dynamic_content_item',
  'organization_field',
  'macro',
]
const INNER_TYPE_GROUPED_WITH_PARENT = [
  'ticket_field__custom_field_options',
  'user_field__custom_field_options',
  'dynamic_content_item__variants',
  'organization_field__custom_field_options',
  'macro_attachment',
]

const recurseIntoInstanceChangeToGroupId: ChangeIdFunction = async change => {
  const instance = getChangeData(change)
  if (isInstanceElement(instance)) {
    const { typeName } = instance.elemID
    const parent = getParents(instance)?.[0]
    if (INNER_TYPE_GROUPED_WITH_PARENT.includes(typeName) && isReferenceExpression(parent)) {
      return parent.elemID.getFullName()
    }
    if (PARENT_GROUPED_WITH_INNER_TYPE.includes(typeName)) {
      return instance.elemID.getFullName()
    }
  }
  return undefined
}

const typeNameChangeGroupId: ChangeIdFunction = async change =>
  getChangeData(change).elemID.typeName

const SectionChangeGroupId: ChangeIdFunction = async change =>
  ((getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
    ? getChangeData(change).elemID.getFullName()
    : undefined)


const changeIdProviders: ChangeIdFunction[] = [
  recurseIntoInstanceChangeToGroupId,
  SectionChangeGroupId,
  typeNameChangeGroupId,
]

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => ({
  changeGroupIdMap: new Map(
    await awu(changes.entries())
      .map(async ([id, change]) => {
        const groupId = await awu(changeIdProviders)
          .map(provider => provider(change))
          .find(values.isDefined)
        return groupId === undefined
          ? [id, getChangeData(change).elemID.getFullName()] as [ChangeId, ChangeGroupId]
          : [id, groupId] as [ChangeId, ChangeGroupId]
      })
      .filter(values.isDefined)
      .toArray()
  ),
})
