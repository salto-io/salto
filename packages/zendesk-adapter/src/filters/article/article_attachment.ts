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
import _, { parseInt } from 'lodash'
import {
  AdditionChange,
  Change, CORE_ANNOTATIONS, DeployResult,
  getChangeData,
  InstanceElement, isAdditionChange,
  isAdditionOrModificationChange, isInstanceElement, isReferenceExpression,
  ModificationChange, ReadOnlyElementsSource, ReferenceExpression,
  SaltoElementError,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { ARTICLE_ATTACHMENT_TYPE_NAME } from '../../constants'
import ZendeskClient from '../../client/client'
import { associateAttachments, createUnassociatedAttachment, deleteArticleAttachment, SUCCESS_STATUS_CODE } from './utils'

export type ArticleWithAttachmentChanges = {
  article?: InstanceElement
  attachmentAdditions: Record<number, AdditionChange<InstanceElement>>
  attachmentModifications: Record<number, {
    oldAttachmentId: number
    newAttachmentId: number
    change: ModificationChange<InstanceElement>
  }>
  attachmentFailures: {
    reason: string
    change: Change<InstanceElement>
  }[]
}

const getAttachmentArticleRef = (
  attachmentInstance: InstanceElement
): ReferenceExpression | undefined => {
  const parentArticleList = attachmentInstance.annotations[CORE_ANNOTATIONS.PARENT]
  if (!_.isArray(parentArticleList)) {
    return undefined
  }
  const parentArticleRef = parentArticleList[0]
  if (!isReferenceExpression(parentArticleRef)) {
    return undefined
  }
  return parentArticleRef
}

export const prepareArticleAttachmentsForDeploy = async ({ changes, client, elementsSource }: {
  changes: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[]
  client: ZendeskClient
  elementsSource: ReadOnlyElementsSource
}): Promise<Record<string, ArticleWithAttachmentChanges>> => {
  const articleNameToAttachments: Record<string, ArticleWithAttachmentChanges> = {}
  await Promise.all(changes.map(async attachmentChange => {
    const attachmentInstance = getChangeData(attachmentChange)

    let parentArticle: InstanceElement | undefined
    let failureReason: string | undefined
    const attachmentWithUnresolvedParent = await elementsSource.get(attachmentInstance.elemID)
    if (isInstanceElement(attachmentWithUnresolvedParent)) {
      const parentArticleRef = getAttachmentArticleRef(attachmentWithUnresolvedParent)
      if (parentArticleRef !== undefined) {
        const articleInstance = await parentArticleRef.getResolvedValue(elementsSource)
        if (isInstanceElement(articleInstance)) {
          parentArticle = articleInstance
        } else {
          failureReason = 'Resolved parent article is not an instance element'
        }
      } else {
        failureReason = 'Resolved attachment\'s parent is invalid'
      }
    } else {
      failureReason = 'Resolved attachment is not an instance element'
    }

    // if we did not find the parent article, the name is irrelevant because we just need a unique key
    const articleName = parentArticle ? parentArticle.elemID.name : ''
    articleNameToAttachments[articleName] = {
      article: parentArticle,
      attachmentAdditions: articleNameToAttachments[articleName]?.attachmentAdditions ?? {},
      attachmentModifications: articleNameToAttachments[articleName]?.attachmentModifications ?? {},
      attachmentFailures: articleNameToAttachments[articleName]?.attachmentFailures ?? [],
    }

    // These failure reasons are not service dependent and will always require investigation from our side
    if (failureReason) {
      articleNameToAttachments[articleName].attachmentFailures.push({
        reason: failureReason,
        change: attachmentChange,
      })
      return
    }

    // Create the new attachment, unassociated, that will be associated in the deploy stage
    const { id: newAttachmentId, error = '' } = await createUnassociatedAttachment(client, attachmentInstance)
    if (!_.isEmpty(error) || newAttachmentId === undefined) {
      articleNameToAttachments[articleName].attachmentFailures.push({
        reason: error,
        change: attachmentChange,
      })
      return
    }

    // Addition just associates the new attachment
    // Modification associates the new attachment and then deletes the old one
    if (isAdditionChange(attachmentChange)) {
      articleNameToAttachments[articleName].attachmentAdditions[newAttachmentId] = attachmentChange
    } else {
      const oldAttachmentId = attachmentChange.data.before.value.id
      articleNameToAttachments[articleName].attachmentModifications[newAttachmentId] = {
        oldAttachmentId,
        newAttachmentId,
        change: attachmentChange,
      }
    }
  }))
  return articleNameToAttachments
}

export const associateAttachmentToArticles = async ({
  articleNameToAttachments,
  client,
}: {
  articleNameToAttachments: Record<string, ArticleWithAttachmentChanges>
  client: ZendeskClient
}): Promise<DeployResult> => {
  const deployResult: {
    appliedChanges: Change<InstanceElement>[]
    errors: SaltoElementError[]
  } = {
    appliedChanges: [],
    errors: [],
  }

  await Promise.all(Object.values(articleNameToAttachments).flatMap(async articleWithAttachmentChanges => {
    const {
      article,
      attachmentAdditions,
      attachmentModifications,
      attachmentFailures,
    } = articleWithAttachmentChanges
    // If the article was not found, we can't associate any attachments
    if (article === undefined) {
      attachmentFailures.forEach(failure => deployResult.errors.push({
        elemID: getChangeData(failure.change).elemID,
        severity: 'Error',
        message: failure.reason,
      }))
      return []
    }

    const additionResults = await associateAttachments(
      client,
      article,
      Object.keys(attachmentAdditions).map(parseInt)
    )
    const modificationResults = await associateAttachments(
      client,
      article,
      Object.values(attachmentModifications).map(modification => modification.newAttachmentId)
    )

    // On Additions, mark the change as either applied or error, according to the association status
    await Promise.all(additionResults.flatMap(async ({ status, ids, error }) => {
      if (status === SUCCESS_STATUS_CODE) {
        ids.forEach(id => deployResult.appliedChanges.push(attachmentAdditions[id]))
        return []
      }
      ids.forEach(id => deployResult.errors.push({
        elemID: getChangeData(attachmentAdditions[id]).elemID,
        severity: 'Error',
        message: error,
      }))
      return ids.map(id => deleteArticleAttachment(client, id))
    }))

    return modificationResults.map(async ({ status, ids, error }) => {
      const attachmentIdsToDelete = []
      // If the association was successful, mark the changes as applies and delete the old attachment
      if (status === SUCCESS_STATUS_CODE) {
        ids.forEach(id => deployResult.appliedChanges.push(attachmentModifications[id].change))
        attachmentIdsToDelete.push(
          ...Object.values(attachmentModifications).map(modification => modification.oldAttachmentId)
        )
        // If the association was unsuccessful, mark the changes as error and delete the new attachment
      } else {
        ids.forEach(id => deployResult.errors.push({
          elemID: getChangeData(attachmentModifications[id].change).elemID,
          severity: 'Error',
          message: error,
        }))
        attachmentIdsToDelete.push(
          ...Object.values(attachmentModifications).map(modification => modification.newAttachmentId)
        )
      }

      return attachmentIdsToDelete.map(id => deleteArticleAttachment(client, id))
    })
  }))
  return deployResult
}

/**
 * Handle association of article attachments during deploy
 */
const articleAttachmentsFilter: FilterCreator = ({ client, elementsSource }) => ({
  name: 'articleAttachmentsFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [attachmentChanges, leftoverChanges] = _.partition(
      changes,
      change => isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME
    )

    const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({
      changes: attachmentChanges.filter(isAdditionOrModificationChange), // Used for casting
      client,
      elementsSource,
    })

    const deployResult = await associateAttachmentToArticles({
      articleNameToAttachments,
      client,
    })

    return {
      deployResult,
      leftoverChanges,
    }
  },
})

export default articleAttachmentsFilter
