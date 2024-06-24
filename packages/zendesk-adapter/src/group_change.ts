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
import { getChangeData, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import {
  SECTION_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
} from './constants'

const PARENT_GROUPED_WITH_INNER_TYPE = [
  TICKET_FIELD_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  'dynamic_content_item',
  ORG_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  'macro',
  ARTICLE_TYPE_NAME,
]
const INNER_TYPE_GROUPED_WITH_PARENT = [
  'ticket_field__custom_field_options',
  'user_field__custom_field_options',
  'dynamic_content_item__variants',
  'organization_field__custom_field_options',
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  'macro_attachment',
  ARTICLE_ATTACHMENT_TYPE_NAME,
]

const recurseIntoInstanceChangeToGroupId: deployment.grouping.ChangeIdFunction = async change => {
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

const typeNameChangeGroupId: deployment.grouping.ChangeIdFunction = async change =>
  getChangeData(change).elemID.typeName

// sections need to be grouped separately as there are dependencies with 'parent_section_id'
const sectionChangeGroupId: deployment.grouping.ChangeIdFunction = async change =>
  getChangeData(change).elemID.typeName === SECTION_TYPE_NAME ? getChangeData(change).elemID.getFullName() : undefined

export const getChangeGroupIds = deployment.grouping.getChangeGroupIdsFunc([
  recurseIntoInstanceChangeToGroupId,
  sectionChangeGroupId,
  typeNameChangeGroupId,
])
