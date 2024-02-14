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

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, strings, promises } from '@salto-io/lowerdash'
import {
  AdditionChange,
  Change,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceElement,
  isModificationChange,
  isObjectType,
  isReferenceExpression,
  isRemovalChange,
  ModificationChange,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { createSchemeGuard, getParents, resolveChangeElement } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { FilterCreator } from '../../filter'
import { deployChange, deployChanges } from '../../deployment'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_ATTACHMENTS_FIELD, ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  EVERYONE_USER_TYPE,
  USER_SEGMENT_TYPE_NAME,
  ZENDESK,
} from '../../constants'
import { addRemovalChangesId, isTranslation } from '../guide_section_and_category'
import { lookupFunc } from '../field_references'
import { removeTitleAndBody } from '../guide_fetch_article_section_and_category'
import ZendeskClient from '../../client/client'
import {
  createUnassociatedAttachment,
  deleteArticleAttachment,
  getArticleAttachments,
  isAttachments,
  updateArticleTranslationBody,
} from './utils'
import { API_DEFINITIONS_CONFIG, CLIENT_CONFIG, FETCH_CONFIG, isGuideEnabled, ZendeskConfig } from '../../config'


const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { matchAll } = strings
const { sleep } = promises.timeout

const USER_SEGMENT_ID_FIELD = 'user_segment_id'
const ATTACHMENTS_IDS_REGEX = new RegExp(`(?<url>/${ARTICLE_ATTACHMENTS_FIELD}/)(?<id>\\d+)`, 'g')
const RATE_LIMIT_FOR_UNASSOCIATED_ATTACHMENT = 50

export type TranslationType = {
  title: string
  body?: string
  locale: { locale: string }
}
type AttachmentWithId = {
  id: number
}

const EXPECTED_ATTACHMENT_SCHEMA = Joi.object({
  id: Joi.number().required(),
}).unknown(true).required()

const isAttachmentWithId = createSchemeGuard<AttachmentWithId>(
  EXPECTED_ATTACHMENT_SCHEMA, 'Received an invalid value for attachment id'
)

const addPlaceholderTitleAndBodyValues = async (change: Change<InstanceElement>): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, lookupFunc)
  const currentLocale = getChangeData(resolvedChange).value.source_locale
  const translation = getChangeData(resolvedChange).value.translations
    .filter(isTranslation)
    .find((tran: TranslationType) => tran.locale?.locale === currentLocale)
  if (translation !== undefined) {
    getChangeData(change).value.title = translation.title
    getChangeData(change).value.body = ''
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
// Similarly, when modifying the user segment to "Everyone", manually add the value
const setUserSegmentIdForAdditionOrModificationChanges = (
  changes: Change<InstanceElement>[]
): void => {
  changes
    .map(getChangeData)
    .filter(articleInstance => articleInstance.value[USER_SEGMENT_ID_FIELD] === undefined)
    .forEach(articleInstance => {
      articleInstance.value[USER_SEGMENT_ID_FIELD] = null
    })
}

const haveAttachmentsBeenAdded = (
  articleChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
): boolean => {
  const addedAttachments = isAdditionChange(articleChange)
    ? articleChange.data.after.value.attachments
    : _.differenceWith(
      articleChange.data.after.value.attachments,
      articleChange.data.before.value.attachments,
      (afterAttachment, beforeAttachment) => (
        (isReferenceExpression(beforeAttachment)
          && isReferenceExpression(afterAttachment)
          && _.isEqual(afterAttachment.elemID, beforeAttachment.elemID))
        || (isAttachmentWithId(beforeAttachment)
          && isAttachmentWithId(afterAttachment)
          && _.isEqual((afterAttachment as AttachmentWithId).id, (beforeAttachment as AttachmentWithId).id))
      )
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
  article: InstanceElement,
  attachmentsIds: number[]
): Promise<boolean> => {
  const attachChunk = _.chunk(attachmentsIds, 20)
  const articleId = article.value.id
  log.debug(`there are ${attachmentsIds.length} attachments to associate for article ${article.elemID.name}, associating in chunks of 20`)
  const allRes = await Promise.all(attachChunk.map(async (chunk: number[], index: number) => {
    log.debug(`starting article attachment associate chunk ${index + 1}/${attachChunk.length} for article ${article.elemID.name}`)
    const res = await client.post({
      url: `/api/v2/help_center/articles/${articleId}/bulk_attachments`,
      data: { attachment_ids: chunk },
    })
    if (res.status !== 200) {
      log.warn(`could not associate chunk number ${index} for article ${article.elemID.name} received status ${res.status}. The unassociated attachment ids are: ${chunk}`)
    }
    return res.status
  }))
  return _.isEmpty(allRes.filter(status => status !== 200))
}

const createUnassociatedAttachmentFromChange = async ({
  attachmentChange,
  client,
  elementsSource,
  articleNameToAttachments,
}:{
  attachmentChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
  client: ZendeskClient
  elementsSource: ReadOnlyElementsSource
  articleNameToAttachments: Record<string, number[]>
}): Promise<void> => {
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
    const res = await associateAttachments(client, articleInstance, [attachmentInstance.value.id])
    if (!res) {
      log.error(`Association of attachment ${instanceBeforeResolve.elemID.name} with id ${attachmentInstance.value.id} has failed `)
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
}

const handleArticleAttachmentsPreDeploy = async ({
  changes,
  client,
  elementsSource,
  articleNameToAttachments,
  config,
}: {
  changes: Change<InstanceElement>[]
  client: ZendeskClient
  elementsSource: ReadOnlyElementsSource
  articleNameToAttachments: Record<string, number[]>
  config: ZendeskConfig
}): Promise<InstanceElement[]> => {
  const attachmentChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME)

  if (attachmentChanges.length === 0) {
    return []
  }
  const chunkSize = config[CLIENT_CONFIG]?.unassociatedAttachmentChunkSize ?? RATE_LIMIT_FOR_UNASSOCIATED_ATTACHMENT
  log.debug(`there are ${attachmentChanges.length} attachment changes, going to handle them in chunks of ${chunkSize}`)
  const attachChangesChunks = _.chunk(attachmentChanges, chunkSize)
  await awu(attachChangesChunks)
    .forEach(async (
      attachmentChangesChunk: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[],
      index: number,
    ) => {
      log.debug(`starting article attachment change chunk ${index + 1}/${attachChangesChunks.length}`)
      await awu(attachmentChangesChunk).forEach(attachmentChange => createUnassociatedAttachmentFromChange({
        attachmentChange,
        client,
        elementsSource,
        articleNameToAttachments,
      }))
      await sleep(1000)
    })
  // Article bodies needs to be updated when modifying inline attachments
  // There might be another request if the article_translation 'body' fields also changed
  // (To Do: SALTO-3076)
  const modificationAndAdditionInlineChanges = attachmentChanges
    .filter(isAdditionOrModificationChange)
    .filter(attachmentChange => getChangeData(attachmentChange).value.inline)
  const modifiedInlineAttachments = modificationAndAdditionInlineChanges.filter(isModificationChange)
  if (modifiedInlineAttachments.length > 0) {
    const modificationAndAdditionInlineInstances = modificationAndAdditionInlineChanges.map(getChangeData)
    // All the attachments in the current change_group share the same parent article instance
    const articleValues = getParents(modificationAndAdditionInlineInstances[0])[0]
    await updateArticleTranslationBody({
      client,
      articleValues,
      attachmentInstances: modificationAndAdditionInlineInstances,
    })
  }
  return attachmentChanges.map(getChangeData)
}

const getId = (instance: InstanceElement): number => instance.value.id
const getName = (instanceOrRef: InstanceElement | ReferenceExpression): string => instanceOrRef.elemID.name
const getFilename = (attachment: InstanceElement | undefined): string => attachment?.value.file_name
const getContentType = (attachment: InstanceElement | undefined): string => attachment?.value.content_type
const getInline = (attachment: InstanceElement | undefined): boolean => attachment?.value.inline

const isRemovedAttachment = (
  attachment: unknown,
  articleRemovedAttachmentsIds: Set<number>,
): boolean => {
  const id = isReferenceExpression(attachment) && isInstanceElement(attachment.value)
    ? getId(attachment.value)
    : undefined
  return id !== undefined && articleRemovedAttachmentsIds.has(id)
}

const getAttachmentData = (
  article: InstanceElement,
  attachmentById: Record<number, InstanceElement>,
  translationByName: Record<string, InstanceElement>
): {
  inlineAttachmentsNameById: Record<number, string>
  attachmentIdsFromArticleBody: Set<number | undefined>
} => {
  const attachmentsIds = makeArray(article.value.attachments)
    .filter(isReferenceExpression).filter(ref => isInstanceElement(ref.value)).map(ref => getId(ref.value))
  const inlineAttachmentInstances = attachmentsIds
    .map(id => attachmentById[id])
    .filter(isInstanceElement)
    .filter(attachment => attachment.value.inline)
    .filter(attachment => getId(attachment) !== undefined)
  const inlineAttachmentsNameById = _.mapValues(_.keyBy(inlineAttachmentInstances, getId), getName)
  const articleBodies = makeArray(article.value.translations).filter(isReferenceExpression)
    .map((ref: ReferenceExpression) => translationByName[ref.elemID.name]?.value.body).join('\n')
  const attachmentIdsFromArticleBody = new Set(
    Array.from(
      matchAll(articleBodies, ATTACHMENTS_IDS_REGEX),
      (match: RegExpMatchArray | undefined) => match?.groups?.id
    ).filter(id => id !== undefined).map(Number)
  )
  return { inlineAttachmentsNameById, attachmentIdsFromArticleBody }
}

/**
 * returns deleted attachments ids
 * due to an API limitation on the zendesk side, inline attachments deleted from the article body are still returned
 * from the call to /api/v2/help_center/articles/{article_id}/attachments even though they no longer exist.
 * we do not want to include these orphaned attachments in the fetch results, so we omit inline attachments that are not
 * referenced from the article body.
 */
const calculateAndRemoveDeletedAttachments = ({
  articleInstances,
  attachmentById,
  translationsByName,
}: {
  articleInstances: InstanceElement[]
  attachmentById: Record<number, InstanceElement>
  translationsByName: Record<string, InstanceElement>
}): Set<number> => {
  const allRemovedAttachmentsIds = new Set<number>()
  const allRemovedAttachmentsNames = new Set<string>()
  articleInstances.forEach(article => {
    const articleRemovedAttachmentsIds = new Set<number>()
    const attachmentData = getAttachmentData(article, attachmentById, translationsByName)
    Object.keys(attachmentData.inlineAttachmentsNameById).forEach(id => {
      const numberId = Number(id)
      if (!attachmentData.attachmentIdsFromArticleBody.has(numberId)) {
        articleRemovedAttachmentsIds.add(numberId)
        allRemovedAttachmentsNames.add(attachmentData.inlineAttachmentsNameById[numberId])
        allRemovedAttachmentsIds.add(numberId)
      }
    })
    article.value.attachments = makeArray(article.value.attachments).filter(
      (attachment: unknown) => !isRemovedAttachment(attachment, articleRemovedAttachmentsIds)
    )
  })
  log.info(`the following article attachments are not going to be included in the fetch, since they are inline but do not appear in the body: ${Array.from(allRemovedAttachmentsNames)}`)
  return allRemovedAttachmentsIds
}

/**
 * Deploys articles and adds default user_segment value to visible articles
 */
const filterCreator: FilterCreator = ({ config, client, elementsSource, brandIdToClient = {} }) => {
  const articleNameToAttachments: Record<string, number[]> = {}
  return {
    name: 'articleFilter',
    onFetch: async (elements: Element[]) => {
      if (!isGuideEnabled(config[FETCH_CONFIG])) {
        return { errors: [] }
      }

      const articleInstances = elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
        .filter(article => article.value.id !== undefined)
      setupArticleUserSegmentId(elements, articleInstances)
      const attachments = elements
        .filter(instance => instance.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME)
      const attachmentType = attachments.find(isObjectType)
      if (attachmentType === undefined) {
        log.error('could not find article_attachment object type')
        return { errors: [] }
      }
      const articleById: Record<number, InstanceElement> = _.keyBy(articleInstances, getId)
      _.remove(attachments, isObjectType)
      const attachmentByName: Record<string, InstanceElement> = _.keyBy(
        attachments
          .filter(isInstanceElement)
          .filter(attachment => getName(attachment) !== undefined),
        getName,
      )
      const attachmentById: Record<number, InstanceElement> = _.keyBy(
        attachments
          .filter(isInstanceElement)
          .filter(attachment => getId(attachment) !== undefined),
        getId,
      )
      const translationsByName = _.keyBy(
        elements
          .filter(isInstanceElement)
          .filter(instance => instance.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME),
        getName,
      )
      const allRemovedAttachmentsIds = calculateAndRemoveDeletedAttachments({
        articleInstances,
        attachmentById,
        translationsByName,
      })
      _.remove(
        attachments,
        (attachment => isInstanceElement(attachment) && allRemovedAttachmentsIds.has(getId(attachment)))
      )
      // If in the future articles could share attachments this would have to be changed! We delete attachments that
      // do not appear in one article, we currently do not check across all articles.
      _.remove(
        elements,
        (element => element.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME
          && isInstanceElement(element)
          && allRemovedAttachmentsIds.has(getId(element)))
      )
      const attachmentErrors = await getArticleAttachments({
        brandIdToClient,
        attachmentType,
        articleById,
        apiDefinitions: config[API_DEFINITIONS_CONFIG],
        attachments: isAttachments(attachments) ? attachments : [],
        config,
      })
      articleInstances.forEach(article => {
        const sortedAttachments = _.sortBy(article.value.attachments, [
          (attachment: ReferenceExpression) => getFilename(attachmentByName[attachment.elemID.name]),
          (attachment: ReferenceExpression) => getContentType(attachmentByName[attachment.elemID.name]),
          (attachment: ReferenceExpression) => getInline(attachmentByName[attachment.elemID.name]),
        ])
        article.value.attachments = sortedAttachments
      })
      return { errors: attachmentErrors }
    },
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      await handleArticleAttachmentsPreDeploy(
        { changes, client, elementsSource, articleNameToAttachments, config }
      )
      await awu(changes)
        .filter(isAdditionChange)
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
        .forEach(async change => {
          // We add the title and the body values for articles creation
          await addPlaceholderTitleAndBodyValues(change)
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
      setUserSegmentIdForAdditionOrModificationChanges(articleAdditionAndModificationChanges)
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
              articleInstance,
              articleNameToAttachments[articleInstance.elemID.name] ?? [],
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
      const relevantChanges = changes.filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      if (relevantChanges.length === 0) {
        return
      }

      const everyoneUserSegmentElemID = new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME, 'instance', EVERYONE_USER_TYPE)
      const everyoneUserSegmentInstance = await elementsSource.get(everyoneUserSegmentElemID)
      relevantChanges
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
