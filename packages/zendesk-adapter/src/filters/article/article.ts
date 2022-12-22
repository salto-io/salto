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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  AdditionChange,
  Change, ElemID, getChangeData, InstanceElement, isAdditionChange, isModificationChange,
  isAdditionOrModificationChange, isInstanceElement, isReferenceExpression, ReadOnlyElementsSource,
  isRemovalChange, ModificationChange, ReferenceExpression, Element, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { getParents, replaceTemplatesWithValues, resolveChangeElement } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { deployChange, deployChanges } from '../../deployment'
import {
  ARTICLE_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  ZENDESK,
  EVERYONE_USER_TYPE,
} from '../../constants'
import { addRemovalChangesId, isTranslation } from '../guide_section_and_category'
import { lookupFunc } from '../field_references'
import { removeTitleAndBody } from '../guide_fetch_article_section_and_category'
import { prepRef } from './article_body'
import ZendeskClient from '../../client/client'
import { createAttachmentType, createUnassociatedAttachment, deleteArticleAttachment, getArticleAttachments, updateArticleTranslationBody } from './utils'
import { API_DEFINITIONS_CONFIG } from '../../config'

const log = logger(module)
const { awu } = collections.asynciterable

const USER_SEGMENT_ID_FIELD = 'user_segment_id'

export type TranslationType = {
  title: string
  body?: string
  locale: { locale: string }
}

const addTranslationValues = async (change: Change<InstanceElement>): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, lookupFunc)
  const currentLocale = getChangeData(resolvedChange).value.source_locale
  const translation = getChangeData(resolvedChange).value.translations
    .filter(isTranslation)
    .find((tran: TranslationType) => tran.locale?.locale === currentLocale)
  if (translation !== undefined) {
    getChangeData(change).value.title = translation.title
    getChangeData(change).value.body = translation.body ?? ''
  }
}

const setupArticleUserSegmentId = (
  elements: Element[],
  articleInstances: InstanceElement[],
): void => {
  const everyoneUserSegmentInstance = elements
    .filter(instance => instance.elemID.typeName === USER_SEGMENT_TYPE_NAME)
    .find(instance => instance.elemID.name === EVERYONE_USER_TYPE)
  if (everyoneUserSegmentInstance === undefined) {
    log.info("Couldn't find Everyone user_segment instance.")
    return
  }
  articleInstances
    .filter(article => article.value[USER_SEGMENT_ID_FIELD] === undefined)
    .forEach(article => {
      article.value[USER_SEGMENT_ID_FIELD] = new ReferenceExpression(
        everyoneUserSegmentInstance.elemID,
        everyoneUserSegmentInstance,
      )
    })
}

// The default user_segment we added will be resolved to undefined
// So in order to create a new article we need to add a null value user_segment_id
const setUserSegmentIdForAdditionChanges = (
  changes: Change<InstanceElement>[]
): void => {
  changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(articleInstance => articleInstance.value[USER_SEGMENT_ID_FIELD] === undefined)
    .forEach(articleInstance => {
      articleInstance.value[USER_SEGMENT_ID_FIELD] = null
    })
}

const haveAttachmentsBeenAdded = (
  articleChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): boolean => {
  const addedAttachments = isAdditionChange(articleChange)
    ? articleChange.data.after.value.attachments
    : _.differenceWith(
      articleChange.data.after.value.attachments,
      articleChange.data.before.value.attachments,
      (afterAttachment, beforeAttachment) => (
        isReferenceExpression(beforeAttachment)
        && isReferenceExpression(afterAttachment)
        && _.isEqual(afterAttachment.elemID, beforeAttachment.elemID))
    )
  if (!_.isArray(addedAttachments)) {
    return false
  }
  return addedAttachments.length > 0
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

const associateAttachments = async (
  client: ZendeskClient,
  articleId: number,
  attachmentsIds: number[]
): Promise<number> => {
  const res = await client.post({
    url: `/api/v2/help_center/articles/${articleId}/bulk_attachments`,
    data: { attachment_ids: attachmentsIds },
  })
  return res.status
}

const handleArticleAttachmentsPreDeploy = async ({ changes, client, elementsSource, articleNameToAttachments }: {
  changes: Change<InstanceElement>[]
  client: ZendeskClient
  elementsSource: ReadOnlyElementsSource
  articleNameToAttachments: Record<string, number[]>
}): Promise<InstanceElement[]> => {
  const attachmentChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME)
  await awu(attachmentChanges)
    .forEach(async attachmentChange => {
      const attachmentInstance = getChangeData(attachmentChange)
      await createUnassociatedAttachment(client, attachmentInstance)
      // Keeping article-attachment relation for deploy stage
      const instanceBeforeResolve = await elementsSource.get(attachmentInstance.elemID)
      if (instanceBeforeResolve === undefined) {
        log.error(`Couldn't find attachment ${attachmentInstance.elemID.name} instance.`)
        // Deleting the newly created udpated-id attachment instance
        await deleteArticleAttachment(client, attachmentInstance)
        return
      }
      const parentArticleRef = getAttachmentArticleRef(instanceBeforeResolve)
      if (parentArticleRef === undefined) {
        log.error(`Couldn't find attachment ${instanceBeforeResolve.elemID.name} article parent instance.`)
        await deleteArticleAttachment(client, attachmentInstance)
        return
      }
      // We can't really modify article attachments in Zendesk
      // To do so we're going to delete the existing attachment and create a new one instead
      if (isModificationChange(attachmentChange)) {
        const articleInstance = await parentArticleRef.getResolvedValue(elementsSource)
        if (articleInstance === undefined) {
          log.error(`Couldn't get article ${parentArticleRef} in the elementsSource`)
          await deleteArticleAttachment(client, attachmentInstance)
          return
        }
        const res = await associateAttachments(client, articleInstance.value.id, [attachmentInstance.value.id])
        if (res !== 200) {
          log.error(`Association of attachment ${instanceBeforeResolve.elemID.name} has failed with response status ${res}`)
          await deleteArticleAttachment(client, attachmentInstance)
          return
        }
        await deleteArticleAttachment(client, attachmentChange.data.before)
        return
      }
      const parentArticleName = parentArticleRef.elemID.name
      articleNameToAttachments[parentArticleName] = (
        articleNameToAttachments[parentArticleName] || []
      ).concat(attachmentInstance.value.id)
    })
  // Article bodies needs to be updated when modifying inline attachments
  // There might be another request if the article_translation 'body' fields also changed
  // (To Do: SALTO-3076)
  const modifiedInlineAttachments = attachmentChanges
    .filter(isModificationChange)
    .map(getChangeData)
    .filter(attachmentInstance => attachmentInstance.value.inline)
  if (modifiedInlineAttachments.length > 0) {
    // All the attachments in the current change_group share the same parent article instance
    const articleValues = getParents(modifiedInlineAttachments[0])[0]
    await updateArticleTranslationBody({ client, articleValues, attachmentInstances: modifiedInlineAttachments })
  }
  return attachmentChanges.map(getChangeData)
}

/**
 * Deploys articles and adds default user_segment value to visible articles
 */
const filterCreator: FilterCreator = ({ config, client, elementsSource, brandIdToClient = {} }) => {
  const articleNameToAttachments: Record<string, number[]> = {}
  return {
    onFetch: async (elements: Element[]) => log.time(async () => {
      const articleInstances = elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
      setupArticleUserSegmentId(elements, articleInstances)
      const attachmentType = createAttachmentType()
      const articleAttachments = (await Promise.all(articleInstances
        .map(async article => getArticleAttachments({
          client: brandIdToClient[article.value.brand],
          attachmentType,
          article,
          apiDefinitions: config[API_DEFINITIONS_CONFIG],
        })))).flat()

      // Verify article_attachment type added only once
      _.remove(elements, element => element.elemID.isEqual(attachmentType.elemID))
      elements.push(attachmentType, ...articleAttachments)
    }, 'articlesFilter'),
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      const addedArticleAttachments = await handleArticleAttachmentsPreDeploy(
        { changes, client, elementsSource, articleNameToAttachments }
      )
      await awu(changes)
        .filter(isAdditionChange)
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
        .forEach(async change => {
          // We add the title and the resolved body values for articles creation
          await addTranslationValues(change)
          const instance = getChangeData(change)
          try {
            replaceTemplatesWithValues(
              { values: [instance.value], fieldName: 'body' },
              {},
              (part: ReferenceExpression) => (
                part.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME
                  ? addedArticleAttachments
                    .find(attachment => attachment.elemID.isEqual(part.elemID))
                    ?.value.id.toString()
                  : prepRef(part)
              ),
            )
          } catch (e) {
            log.error('Error parsing article body value in deployment', e)
          }
        })
    },

    deploy: async (changes: Change<InstanceElement>[]) => {
      const [articleAdditionAndModificationChanges, otherChanges] = _.partition(
        changes,
        change =>
          (getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
          && !isRemovalChange(change),
      )
      // otherChanges contains removal changes of article!
      const articleRemovalChanges = otherChanges
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      addRemovalChangesId(articleRemovalChanges)
      setUserSegmentIdForAdditionChanges(articleAdditionAndModificationChanges)
      const articleDeployResult = await deployChanges(
        articleAdditionAndModificationChanges,
        async change => {
          await deployChange(
            change, client, config.apiDefinitions, ['translations', 'attachments'],
          )
          const articleInstance = getChangeData(change)
          if (isAdditionOrModificationChange(change) && haveAttachmentsBeenAdded(change)) {
            await associateAttachments(
              client,
              articleInstance.value.id,
              articleNameToAttachments[articleInstance.elemID.name],
            )
          }
        },
      )
      const [attachmentAdditions, leftoverChanges] = _.partition(
        otherChanges,
        change => (
          isAdditionOrModificationChange(change)
          && getChangeData(change).elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME
        )
      )
      const deployResult = {
        appliedChanges: [...articleDeployResult.appliedChanges, ...attachmentAdditions],
        errors: articleDeployResult.errors,
      }
      return { deployResult, leftoverChanges }
    },

    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      const everyoneUserSegmentElemID = new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME, 'instance', EVERYONE_USER_TYPE)
      const everyoneUserSegmentInstance = await elementsSource.get(everyoneUserSegmentElemID)
      changes
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
        .map(getChangeData)
        .forEach(articleInstance => {
          removeTitleAndBody(articleInstance)
          if (articleInstance.value[USER_SEGMENT_ID_FIELD] === null) {
            articleInstance.value[USER_SEGMENT_ID_FIELD] = new ReferenceExpression(
              everyoneUserSegmentInstance.elemID,
              everyoneUserSegmentInstance,
            )
          }
        })
    },
  }
}

export default filterCreator
