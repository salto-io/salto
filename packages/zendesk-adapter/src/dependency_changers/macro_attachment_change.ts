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
import {
  Change,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  DependencyChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { MACRO_ATTACHMENT_TYPE_NAME } from '../filters/macro_attachments'

const createDependencyChange = (
  change: { key: collections.set.SetId; change: Change<InstanceElement> },
  changes: { key: collections.set.SetId; change: Change<InstanceElement> }[],
): DependencyChange[] =>
  changes
    .filter(
      c =>
        getChangeData(change.change).value.find(
          (macroRef: ReferenceExpression) => getChangeData(c.change).elemID === macroRef.value.elemID,
        ) !== undefined,
    )
    .map(macroChange => dependencyChange('remove', change.key, macroChange.key))

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  isInstanceChange(change) && getChangeData(change).elemID.typeName === MACRO_ATTACHMENT_TYPE_NAME

/**
 * Removed the dependency between a macro attachment instance and its macro, to avoid circular dependency
 */
export const macroAttachmentDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  return instanceChanges
    .filter(({ change }) => isRelevantChange(change))
    .flatMap(change => createDependencyChange(change, instanceChanges))
}
