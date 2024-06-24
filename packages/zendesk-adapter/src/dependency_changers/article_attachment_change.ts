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
  DependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { getParents } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import _ from 'lodash'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues

const getNameFromChange = (change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>): string =>
  getChangeData(change.change).elemID.getFullName()

const getDependencies = (
  changes: deployment.dependency.ChangeWithKey<Change<InstanceElement>>[],
): DependencyChange[] => {
  const articleModificationChanges = changes.filter(
    change => getChangeData(change.change).elemID.typeName === ARTICLE_TYPE_NAME && isModificationChange(change.change),
  )
  const articleAttachmentAdditionChanges = changes.filter(
    change =>
      getChangeData(change.change).elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME && isAdditionChange(change.change),
  )

  const articleElemIdToChange = _.keyBy(articleModificationChanges, getNameFromChange)
  return articleAttachmentAdditionChanges
    .map(change => {
      const parent = getParents(getChangeData(change.change))[0]
      if (parent === undefined) {
        return undefined
      }
      const parentElemId = parent.elemID.getFullName()
      if (articleElemIdToChange[parentElemId] !== undefined) {
        return dependencyChange('add', change.key, articleElemIdToChange[parentElemId].key)
      }
      return undefined
    })
    .filter(isDefined)
}

/**
 * This dependency changer is used to add dependency between article attachments and their parent article in the case
 * where the article attachment changes are additions and the article changes are modifications. This is because
 * addition of article attachments do not work without the deploy of the corresponding modified article.
 */
export const articleAttachmentDependencyChanger: DependencyChanger = async changes => {
  const potentialChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  return getDependencies(potentialChanges)
}
