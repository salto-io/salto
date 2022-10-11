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
import _ from 'lodash'
import {
  Change, getChangeData, InstanceElement, isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import ZendeskClient from '../client/client'
import { ARTICLE_TYPE_NAME } from '../constants'
import { getZendeskError } from '../errors'
import { FilterCreator } from '../filter'
import { hasRelevantFieldChanged } from '../change_validators/utils'

const addLabelToArticle = async (
  client: ZendeskClient,
  labelName: string,
  articleInstance: InstanceElement
): Promise<void> => {
  try {
    await client.post({
      url: `/help_center/articles/${articleInstance.value.id}`,
      data: { label: { name: labelName } },
    })
  } catch (e) {
    throw getZendeskError(`${articleInstance.elemID.getFullName()}.value.label_names`, e)
  }
}

const removeLabelFromArticle = async (
  client: ZendeskClient,
  labelId: string,
  articleInstance: InstanceElement
): Promise<void> => {
  try {
    await client.delete({
      url: `/help_center/articles/${articleInstance.value.id}/labels/${labelId}`,
    })
  } catch (e) {
    throw getZendeskError(`${articleInstance.elemID.getFullName()}.value.label_names`, e)
  }
}

/**
 * Supports article labels changes
 */
const filterCreator: FilterCreator = ({ client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const changedLabelsArticleChanges = changes
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      .filter(articleChange => hasRelevantFieldChanged(articleChange, 'label_names'))

    // const labelAdditionDeployResults: void[] = changedLabelsArticleChanges
    changedLabelsArticleChanges
      .forEach(articleChange => {
        const beforeArticleLabels = articleChange.action === 'modify' ? articleChange.data.before.value.label_names : []
        const afterArticleLabels = articleChange.data.after.value.label_names

        const addedLabels = _.without(afterArticleLabels, ...beforeArticleLabels)
        addedLabels.forEach(label => addLabelToArticle(
          client,
          label.value.name,
          getChangeData(articleChange)
        ))

        const removedLabels = _.without(beforeArticleLabels, ...afterArticleLabels)
        removedLabels.forEach(label => removeLabelFromArticle(
          client,
          label.value.id,
          getChangeData(articleChange)
        ))
      })
    // Omit label_names from article changes for other changes
    // (should we check if are there further changes?)
    // --------------------------------

    return {
      deployResult: { appliedChanges: [], errors: [] },
      leftoverChanges: changes,
      // deployResult: {
      //   appliedChanges: successfulChanges,
      //   errors: deployLogoErrors,
      // },
      // leftoverChanges,
    }
  },
})

export default filterCreator
