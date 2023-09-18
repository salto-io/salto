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
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { isInstanceElement, isStaticFile } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG } from '../config'
import { ARTICLE_ATTACHMENT_TYPE_NAME } from '../constants'


const log = logger(module)

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
      .filter(attachment =>
        attachment.value.id !== undefined
        && isStaticFile(attachment.value.content)
        && attachment.value.content.hash !== undefined)
    const attachmentsByElemId = _.groupBy(articleAttachmentInstances, elem => elem.elemID.getFullName())
    const idsToRemove = new Set(Object.values(attachmentsByElemId)
      .filter(attachments => attachments.length > 1)
      .flatMap(attachments => {
        const hashSet = new Set(attachments.map(attachment => attachment.value.content.hash))
        // check if there are different files with the same name
        if (hashSet.size !== 1) {
          return []
        }
        // all files have the same hash, so we can remove the duplicates and keep only one
        return attachments.slice(1).map(att => att.value.id)
      }))
    _.remove(elements, elem =>
      isInstanceElement(elem)
      && elem.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME
      && idsToRemove.has(elem.value.id))
  },
})

export default filterCreator
