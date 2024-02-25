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
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { Element, isInstanceElement, isStaticFile, ReferenceExpression } from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG } from '../config'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * This function removed duplicates of attachments from the attachments field in article. It removes all the references
 * that point to an attachment that has been removed previously.
 */
const makeAttachmentFieldUnique = (elements: Element[], idsToRemove: Set<number>): void => {
  const articleInstances = elements
    .filter(isInstanceElement)
    .filter(elem => elem.elemID.typeName === ARTICLE_TYPE_NAME)
    .filter(article => !_.isEmpty(article.value.attachments))

  articleInstances.forEach(article => {
    article.value.attachments = article.value.attachments.filter((attachment: ReferenceExpression | number) => {
      const id = isResolvedReferenceExpression(attachment) ? attachment.value.value.id : attachment
      return !idsToRemove.has(id)
    })
  })
}

/**
 * when handleIdenticalAttachmentConflicts flag is true, this filter will omit article attachments with the same elemId
 * and hash, and keep only one attachment of this type in the elements.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'handleIdenticalAttachmentConflictsFilter',
  onFetch: async elements => {
    if (config[FETCH_CONFIG].handleIdenticalAttachmentConflicts !== true) {
      log.debug('handleIdenticalAttachmentConflicts is false not running handleIdenticalAttachmentConflictsFilter')
      return
    }
    const articleAttachmentInstances = elements
      .filter(isInstanceElement)
      .filter(elem => elem.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME)
      .filter(
        attachment =>
          attachment.value.id !== undefined &&
          isStaticFile(attachment.value.content) &&
          attachment.value.content.hash !== undefined,
      )
    const attachmentsByElemId = _.groupBy(articleAttachmentInstances, elem => elem.elemID.getFullName())
    const duplicateElemIds = new Set<string>()
    const idsToRemove = new Set(
      Object.values(attachmentsByElemId)
        .filter(attachments => attachments.length > 1)
        .flatMap(attachments => {
          const hashSet = new Set(attachments.map(attachment => attachment.value.content.hash))
          // check if there are different files with the same name
          if (hashSet.size !== 1) {
            log.debug(
              `hashSet.size is not 1, meaning that there are different attachments with the same elemId. will not remove duplicates for attachment ${attachments[0].elemID.name}`,
            )
            return []
          }
          // all files have the same hash, so we can remove the duplicates and keep only one
          duplicateElemIds.add(attachments[0].elemID.getFullName())
          return attachments.slice(1).map(att => att.value.id)
        }),
    )
    log.debug('going to remove duplicates for attachments: %s', Array.from(duplicateElemIds).join(','))

    // remove duplicates from attachments field in article
    makeAttachmentFieldUnique(elements, idsToRemove)

    _.remove(
      elements,
      elem =>
        isInstanceElement(elem) &&
        elem.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME &&
        idsToRemove.has(elem.value.id),
    )

    log.debug('ids removed: %s', Array.from(idsToRemove).join(','))
  },
})

export default filterCreator
