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
import { Element, InstanceElement, isInstanceElement, StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import path from 'path'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { EMAIL_TEMPLATE_METADATA_TYPE, RECORDS_PATH, SALESFORCE } from '../constants'
import { isInstanceOfType } from './utils'

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
    instance.value.attachments = makeArray(instance.value.attachments)
    if (isEmailAttachmentsArray(instance.value)) {
      instance.value.attachments.forEach(attachment => {
        attachment.content = createStaticFile(
          // attachmen.content type is a string before the creation of the static file
          folderPath, attachment.name, attachment.content as string
        )
      })
    }
  }
}

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
})

export default filter
