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

import {
  AdditionChange,
  InstanceElement,
  ModificationChange,
  StaticFile,
  getChangeData,
  isStaticFile,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import Joi from 'joi'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { JIRA } from '../constants'
import JiraClient from '../client/client'

type IconResponse = {
  data: {
    id: string
  }
}

const ICON_RESPONSE_SCHEME = Joi.object({
  data: Joi.object({
    id: Joi.string().required(),
  })
    .required()
    .unknown(true),
})
  .required()
  .unknown(true)

export const isIconResponse = createSchemeGuard<IconResponse>(ICON_RESPONSE_SCHEME)

const getIconContent = async (link: string, client: JiraClient): Promise<Buffer> => {
  const queryParams = {
    format: 'png',
  }
  try {
    const res = await client.get({ url: link, queryParams, responseType: 'arraybuffer' })
    const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
    if (res.status === 404) {
      throw new Error(
        'Failed to fetch issue type icon. It might be corrupted. To fix this, upload a new icon in your jira instance.',
      )
    }
    if (!Buffer.isBuffer(content)) {
      throw new Error('Failed to fetch attachment content, response is not a buffer.')
    }
    return content
  } catch (e) {
    throw new Error(
      `Failed to fetch attachment content from Jira API. error: ${e instanceof clientUtils.HTTPError ? e.message : e}`,
    )
  }
}

export const setIconContent = async ({
  client,
  instance,
  link,
  fieldName,
}: {
  client: JiraClient
  instance: InstanceElement
  link: string
  fieldName: string
}): Promise<void> => {
  const iconContent = await getIconContent(link, client)
  instance.value[fieldName] = new StaticFile({
    filepath: `${JIRA}/${instance.elemID.typeName}/${pathNaclCase(naclCase(instance.value.name))}.png`,
    content: iconContent,
  })
}

export const sendIconRequest = async ({
  client,
  change,
  url,
  fieldName,
  headers,
}: {
  client: JiraClient
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
  url: string
  fieldName: string
  headers?: Record<string, string>
}): Promise<clientUtils.ResponseValue> => {
  const instance = getChangeData(change)
  const fileContent = isStaticFile(instance.value[fieldName]) ? await instance.value[fieldName].getContent() : undefined
  if (fileContent === undefined) {
    throw new Error(`Failed to fetch attachment content from icon ${instance.elemID.name}`)
  }
  const resp = await client.post({
    url,
    data: fileContent,
    headers,
  })
  return resp
}
