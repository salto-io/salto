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
import { Element, InstanceElement, isInstanceElement, isStaticFile, StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import Joi from 'joi'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { EMAIL_TEMPLATE_METADATA_TYPE } from '../constants'
import { isInstanceOfType } from './utils'

const { awu } = collections.asynciterable

const log = logger(module)

const createStaticFile = (
  instanceApiName: string,
  folderName: string | undefined,
  name: string,
  content: string
): string | StaticFile | undefined => {
  if (folderName === undefined) {
    log.error(`could not extract the attachment ${name} of instance ${instanceApiName} to static file, instance path is undefined`)
    return content
  }
  return new StaticFile({
    filepath: `${folderName}/${name}`,
    content: Buffer.from(content),
    encoding: 'utf-8',
  })
}

type Attachment = {
  name: string
  content: string
}

type TransformAttachment = {
  name: string
  content: string | StaticFile | undefined
}

const ATTACHMENT = Joi.object({
  name: Joi.string().required(),
  content: Joi.string().required(),
}).required()

const isAttachment = createSchemeGuard<Attachment>(ATTACHMENT)

const createFolder = (instance: InstanceElement): string | undefined => {
  if (isStaticFile(instance.value.content)) {
    const oldPath = instance.value.content.filepath.split('/')
    const emailName = oldPath.pop()
    const folderName = `${oldPath.join('/')}/${emailName?.split('.')[0]}`
    _.set(instance, ['value', 'content', 'filepath'], `${folderName}/${emailName}`)
    return folderName
  } if (instance.path !== undefined) {
    return instance.path.join('/')
  }
  return undefined
}

const organizeStaticFiles = async (instance: InstanceElement): Promise<void> => {
  const folderPath = createFolder(instance)
  const transformFunc: TransformFunc = async ({ value, field }) => {
    const fieldName = _.isUndefined(field) ? undefined : field.name
    if (isAttachment(value) && fieldName === 'attachments') {
      const instApiName = await apiName(instance)
      const transformAttachment: TransformAttachment = {
        ...value,
        content: createStaticFile(instApiName, folderPath, value.name, value.content),
      }
      return transformAttachment
    }
    return value
  }

  const values = instance.value
  const type = await instance.getType()
  instance.value = await transformValues(
    {
      values,
      type,
      transformFunc,
      strict: false,
    }
  ) ?? values
}

/**
 * Extract emailTemplate with attachments and save their content in a static file.
 */
const filter: LocalFilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType(EMAIL_TEMPLATE_METADATA_TYPE))
      .forEach(inst => organizeStaticFiles(inst))
  },
})

export default filter
