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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Change,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  SaltoError,
  StaticFile,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceElement,
  isRemovalChange,
  isStaticFile,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { createSchemeGuard, getParent, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements, client as clientUtils } from '@salto-io/adapter-components'
import Joi from 'joi'
import { FilterCreator } from '../filter'
import { ISSUE_TYPE_ICON_NAME, ISSUE_TYPE_NAME, JIRA } from '../constants'
import JiraClient from '../client/client'
import { deployChanges } from '../deployment/standard_deployment'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../utils'
import { PRIVATE_API_HEADERS } from '../client/headers'

type IssueTypeIconResponse = {
  data: {
    id: string
  }
}

type SystemIssueTypeResponse = {
  system: {
    id: number
  }[]
}
const SYSTEM_ISSUE_TYPE_RESPONSE_SCHEME = Joi.object({
  system: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().required(),
      })
        .required()
        .unknown(true),
    )
    .required(),
})
  .required()
  .unknown(true)

const isSystemIssueTypeResponse = createSchemeGuard<SystemIssueTypeResponse>(SYSTEM_ISSUE_TYPE_RESPONSE_SCHEME)

const ISSUE_TYPE_ICON_RESPONSE_SCHEME = Joi.object({
  data: Joi.object({
    id: Joi.string().required(),
  })
    .required()
    .unknown(true),
})
  .required()
  .unknown(true)

type QueryParamsType = {
  format: string
}

const isIssueTypeIconResponse = createSchemeGuard<IssueTypeIconResponse>(ISSUE_TYPE_ICON_RESPONSE_SCHEME)

const getIconContent = async (url: string, client: JiraClient, queryParams: QueryParamsType): Promise<Buffer> => {
  try {
    const res = await client.get({ url, queryParams, responseType: 'arraybuffer' })
    const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
    if (!Buffer.isBuffer(content)) {
      throw new Error('Failed to fetch attachment content, response is not a buffer.')
    }
    return content
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Failed to fetch attachment content from Jira API. error: ${e.message}`)
    }
    throw new Error('Failed to fetch attachment content from Jira API.')
  }
}
const convertPathName = (pathName: string): string => pathName.replace(/_([a-z])/g, (_match, l) => l.toUpperCase())

const getIcon = async ({
  client,
  parent,
  iconType,
  contentType,
  iconName,
  id,
  queryParams,
}: {
  client: JiraClient
  parent: InstanceElement
  iconType: ObjectType
  contentType: string
  iconName: string
  id: number
  queryParams: QueryParamsType
}): Promise<InstanceElement> => {
  const link = `/rest/api/3/universal_avatar/view/type/issuetype/avatar/${id}`
  const iconContent = await getIconContent(link, client, queryParams)
  const pathName = pathNaclCase(iconName)
  const camelCaseName = convertPathName(pathName)
  const refParent = new ReferenceExpression(parent.elemID, parent)
  const icon = new InstanceElement(
    iconName,
    iconType,
    {
      id,
      fileName: `${camelCaseName}.${contentType}`,
      contentType,
      content: new StaticFile({
        filepath: `${JIRA}/${iconType.elemID.name}/${camelCaseName}.${contentType}`,
        content: iconContent,
      }),
    },
    [JIRA, adapterElements.RECORDS_PATH, iconType.elemID.typeName, pathName],
    {
      [CORE_ANNOTATIONS.PARENT]: [refParent],
    },
  )
  return icon
}

const sendIconRequest = async ({
  client,
  change,
  iconInstance,
  url,
}: {
  client: JiraClient
  change: Change<InstanceElement>
  iconInstance: InstanceElement
  url: string
}): Promise<clientUtils.ResponseValue> => {
  const fileContent =
    isAdditionOrModificationChange(change) && isStaticFile(iconInstance.value.content)
      ? await iconInstance.value.content.getContent()
      : undefined
  if (fileContent === undefined) {
    throw new Error(`Failed to fetch attachment content from icon ${iconInstance.elemID.name}`)
  }
  const resp = await client.post({
    url,
    data: fileContent,
    headers: { ...PRIVATE_API_HEADERS, 'Content-Type': 'image/png' },
  })
  return resp
}

const deployIcon = async (change: Change<InstanceElement>, client: JiraClient): Promise<void> => {
  try {
    const iconInstance = getChangeData(change)
    const parent = getParent(iconInstance)
    if (isRemovalChange(change)) {
      await client.delete({
        url: `/rest/api/3/universal_avatar/type/issuetype/owner/${parent.value.id}/avatar/${iconInstance.value.id}`,
      })
      return
    }
    const iconUrl = `/rest/api/3/universal_avatar/type/issuetype/owner/${parent.value.id}`
    const resp = await sendIconRequest({ client, change, iconInstance, url: iconUrl })
    if (!isIssueTypeIconResponse(resp)) {
      throw new Error('Failed to deploy icon to Jira: Invalid response from Jira API')
    }
    if (isAdditionChange(change)) {
      iconInstance.value.id = resp.data.id
    }
  } catch (e) {
    throw new Error(`Failed to deploy icon to Jira: ${e.message}`)
  }
}

const getSystemIssueTypeIconsIds = async (client: JiraClient): Promise<number[]> => {
  const resp = await client.get({
    url: '/rest/api/3/avatar/issuetype/system',
  })
  if (!isSystemIssueTypeResponse(resp.data)) {
    return []
  }
  return resp.data.system.map(icon => Number(icon.id))
}

const filter: FilterCreator = ({ client }) => ({
  name: 'issueTypeIconFilter',
  onFetch: async elements => {
    if (client.isDataCenter) {
      return { errors: [] }
    }
    const systemIssueTypeIconsIds = await getSystemIssueTypeIconsIds(client)
    const issueTypes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)
      .filter(instance => !systemIssueTypeIconsIds.includes(instance.value.avatarId))
    const iconType = new ObjectType({
      elemID: new ElemID(JIRA, ISSUE_TYPE_ICON_NAME),
      fields: {
        id: {
          refType: BuiltinTypes.SERVICE_ID_NUMBER,
          annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
        },
        content: { refType: BuiltinTypes.STRING },
        contentType: { refType: BuiltinTypes.STRING },
        fileName: { refType: BuiltinTypes.STRING },
      },
      path: [JIRA, adapterElements.TYPES_PATH, ISSUE_TYPE_ICON_NAME],
    })
    setTypeDeploymentAnnotations(iconType)
    await addAnnotationRecursively(iconType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(iconType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(iconType, CORE_ANNOTATIONS.DELETABLE)
    elements.push(iconType)
    const errors: SaltoError[] = []
      await Promise.all(
        issueTypes.map(async issueType => {
          try {
          const queryParams = {
            format: 'png',
          }
          const icon = await getIcon({
            client,
            parent: issueType,
            iconType,
            contentType: 'png',
            iconName: `${issueType.elemID.name}`,
            id: issueType.value.avatarId,
            queryParams,
          })
          elements.push(icon)
        } catch (e) {
          errors.push({ message: e.message, severity: 'Error' })
        }
        }),
      )
    return { errors }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [iconChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ISSUE_TYPE_ICON_NAME,
    )

    const deployResult = await deployChanges(iconChanges, async change => {
      await deployIcon(change, client)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
