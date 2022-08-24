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
import { Element, InstanceElement, isInstanceElement, StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { EMAIL_TEMPLATE_METADATA_TYPE, RECORDS_PATH, SALESFORCE } from '../constants'
import { isInstanceOfType } from './utils'

const { awu } = collections.asynciterable

const log = logger(module)

// Attachment content should be a string before the creation of the static file
type Attachment = {
  name: string
  content: string | StaticFile
}

type EmailAttachmentsArray = {
  attachments: Attachment[]
}

type EmailSingleAttachment = {
  attachments: Attachment
}

const ATTACHMENT = Joi.object({
  name: Joi.string().required(),
  content: Joi.string().required(),
}).required()

const EMAIL_ATTACHMENTS_ARRAY = Joi.object({
  attachments: Joi.array().items(ATTACHMENT).required(),
}).required()

const EMAIL_SINGLE_ATTACHMENT = Joi.object({
  attachments: ATTACHMENT,
}).required()
// make array

const isEmailAttachmentsArray = createSchemeGuard<EmailAttachmentsArray>(EMAIL_ATTACHMENTS_ARRAY)

const isEmailSingleAttachment = createSchemeGuard<EmailSingleAttachment>(EMAIL_SINGLE_ATTACHMENT)


const createStaticFile = (
  folderName: string,
  name: string,
  content: string | StaticFile
): StaticFile =>
  // if (isStaticFile(content)) {
  //   return new StaticFile({
  //     filepath: `${folderName}/${name}`,
  //     content: content.internalContent? ,
  //     encoding: 'utf-8',
  //   })
  // }
  new StaticFile({
    filepath: `${folderName}/${name}`,
    content: Buffer.from(content),
    encoding: 'utf-8',
  })


const createFolder = (instance: InstanceElement): string | undefined => {
  if (!_.isUndefined(instance.value.fullName)) {
    const folderName = `${SALESFORCE}/${RECORDS_PATH}/${EMAIL_TEMPLATE_METADATA_TYPE}/${instance.value.fullName}`
    const emailName = `${instance.value.fullName.split('/').slice(1)}.email`
    instance.value.content = createStaticFile(folderName, emailName, 'bbb')
    return folderName
  }
  return undefined
}

const organizeStaticFiles = async (instance: InstanceElement): Promise<void> => {
  const folderPath = createFolder(instance)
  if (_.isUndefined(folderPath)) {
    const instApiName = await apiName(instance)
    log.warn(`could not extract the attachments of instance ${instApiName}, instance path is undefined`)
  } else if (isEmailSingleAttachment(instance.value)) {
    instance.value.attachments.content = createStaticFile(
      folderPath, instance.value.attachments.name,
      instance.value.attachments.content
    )
  } else if (isEmailAttachmentsArray(instance.value)) {
    instance.value.attachments.forEach(attachment => {
      attachment.content = createStaticFile(folderPath, attachment.name, attachment.content)
    })
  }
}

/**
 * Extract emailTemplate with attachments and save their content in a static file.
 */
const filter: LocalFilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType(EMAIL_TEMPLATE_METADATA_TYPE))
      .forEach(organizeStaticFiles)
  },
})

export default filter
