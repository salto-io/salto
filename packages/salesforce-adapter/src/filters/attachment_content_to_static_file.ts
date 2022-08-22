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
import {
  Element, InstanceElement, isInstanceElement, StaticFile,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'

const { awu } = collections.asynciterable

const log = logger(module)

const EMAIL_TEMPLATE_METADATA_TYPE = 'EmailTemplate'

const createStaticFile = async (
  instance: InstanceElement,
  name: string,
  content: string
): Promise<StaticFile | undefined> => {
  if (instance.path === undefined) {
    log.error(`could not extract the attachment of instance ${await apiName(instance)} to static file, instance path is undefined`)
    return undefined
  }
  return new StaticFile({
    filepath: `${instance.path.join('/')}/${name}`,
    content: Buffer.from(content),
    encoding: 'utf-8',
  })
}

const extractAttachmetsToStaticFile = async (instance: InstanceElement): Promise<void> => {
  const attachments = instance.value.attachments ?? undefined
  if (!_.isArray(attachments)) { // only one attachment
    const path = await createStaticFile(instance, attachments.name, attachments.content)
    attachments.content = path
  } else {
    attachments.forEach(async attachment => {
      attachment.content = await createStaticFile(instance, attachment.name, attachment.content)
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
      .filter(async e => await metadataType(e) === EMAIL_TEMPLATE_METADATA_TYPE)
      .filter(inst => inst.value.attachments !== undefined)
      .forEach(inst => extractAttachmetsToStaticFile(inst))
  },
})

export default filter
