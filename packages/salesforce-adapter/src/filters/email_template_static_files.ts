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
import {
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  StaticFile,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import path from 'path'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { EMAIL_TEMPLATE_METADATA_TYPE, RECORDS_PATH, SALESFORCE } from '../constants'
import { isInstanceOfType, isInstanceOfTypeChange } from './utils'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const log = logger(module)

// Attachment content should be a string before the creation of the static file
type Attachment = {
  name: string
  content: string | StaticFile
}

type EmailAttachmentsArray = {
  attachments: Attachment[]
}

const ATTACHMENT = Joi.object({
  name: Joi.string().required(),
  content: Joi.string().required(),
}).required()

const EMAIL_ATTACHMENTS_ARRAY = Joi.object({
  attachments: Joi.array().items(ATTACHMENT).required(),
}).unknown(true)

const isEmailAttachmentsArray = createSchemeGuard<EmailAttachmentsArray>(EMAIL_ATTACHMENTS_ARRAY)

const createStaticFile = (
  folderName: string,
  name: string,
  content: string
): StaticFile =>
  new StaticFile({
    filepath: `${folderName}/${name}`,
    content: Buffer.from(content, 'base64'),
  })

const findFolderPath = (instance: InstanceElement): string =>
  `${SALESFORCE}/${RECORDS_PATH}/${EMAIL_TEMPLATE_METADATA_TYPE}/${instance.value.fullName}`

const organizeStaticFiles = async (instance: InstanceElement): Promise<void> => {
  const folderPath = findFolderPath(instance)
  if (_.isUndefined(folderPath)) {
    const instApiName = await apiName(instance)
    log.warn(`could not extract the attachments of instance ${instApiName}, instance path is undefined`)
  } else {
    const emailName = `${folderPath.split('/').pop()}.email`
    instance.value.content = new StaticFile({
      filepath: path.join(folderPath, emailName),
      content: await instance.value.content.getContent(),
    })
    try {
      instance.value.attachments = makeArray(instance.value.attachments)
      if (isEmailAttachmentsArray(instance.value)) {
        instance.value.attachments.forEach(attachment => {
          attachment.content = createStaticFile(
            // attachment.content type is a string before the creation of the static file
            folderPath, attachment.name, attachment.content as string
          )
        })
      } else if (!Array.isArray(instance.value.attachments)) {
        log.debug('email template attachments are not an array: %s',
          safeJsonStringify(instance.value.attachments,
            (_key, value) => (_.isString(value) ? _.truncate(value) : value)))
      } else if (instance.value.attachments.length > 0) {
        log.debug('email template attachments exist, but failed JOI validation: %s',
          safeJsonStringify(instance.value.attachments,
            (_key, value) => (_.isString(value) ? _.truncate(value) : value)))
      }
    } catch (err) {
      log.warn('Error when handling email template attachments of %s: %s', instance.elemID.getFullName(), err.message)
    }
  }
}

type ChangedEmailTemplateInstance = InstanceElement & {
  value: InstanceElement['value'] & {
    attachments: {
      content: Buffer | string
    }[]
  }
}

const isEmailTemplateWithAttachmentsInstance = (
  instance: InstanceElement
): instance is ChangedEmailTemplateInstance => (
  makeArray(instance.value.attachments)
    .every(attachment => {
      const content = _.get(attachment, 'content')
      return Buffer.isBuffer(content) || _.isString(content)
    })
)

/**
 * Extract emailTemplate with attachments and save their content in a static file.
 */
const filter: LocalFilterCreator = () => ({
  name: 'emailTemplateFilter',
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType(EMAIL_TEMPLATE_METADATA_TYPE))
      .forEach(organizeStaticFiles)
  },
  // Convert EmailTemplate attachments to base64 string
  preDeploy: async changes => {
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(isInstanceOfTypeChange(EMAIL_TEMPLATE_METADATA_TYPE))
      .map(getChangeData)
      .filter(isEmailTemplateWithAttachmentsInstance)
      .forEach(instance => {
        makeArray(instance.value.attachments)
          .forEach(attachment => {
            if (_.isBuffer(attachment.content)) {
              attachment.content = attachment.content.toString('base64')
            }
          })
      })
  },
  // Convert EmailTemplate attachments back to binary files
  onDeploy: async changes => {
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(isInstanceOfTypeChange(EMAIL_TEMPLATE_METADATA_TYPE))
      .map(getChangeData)
      .filter(isEmailTemplateWithAttachmentsInstance)
      .forEach(instance => {
        makeArray(instance.value.attachments)
          .forEach(attachment => {
            if (_.isString(attachment.content)) {
              attachment.content = Buffer.from(attachment.content, 'base64')
            }
          })
      })
  },
})

export default filter
