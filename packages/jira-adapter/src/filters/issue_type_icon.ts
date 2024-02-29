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
import { elements as adapterElements } from '@salto-io/adapter-components'
import { ResponseValue } from '@salto-io/adapter-components/src/client'
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
  foramt: string
}

const isIssueTypeIconResponse = createSchemeGuard<IssueTypeIconResponse>(ISSUE_TYPE_ICON_RESPONSE_SCHEME)

const createIconType = (): ObjectType =>
  new ObjectType({
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
    path: [JIRA, adapterElements.TYPES_PATH, adapterElements.TYPES_PATH, ISSUE_TYPE_ICON_NAME],
  })

const getLogoContent = async (link: string, client: JiraClient, queryParams: QueryParamsType): Promise<Buffer> => {
  try {
    const res = await client.get({ url: link, queryParams, responseType: 'arraybuffer' })
    const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
    if (!Buffer.isBuffer(content)) {
      throw new Error('Received invalid response from Jira API for attachment content')
    }
    return content
  } catch (e) {
    throw new Error('Failed to fetch attachment content from Jira API')
  }
}
const convertPathName = (pathName: string): string => pathName.replace(/_([a-z])/g, (_match, l) => l.toUpperCase())

const getLogo = async ({
  client,
  parents,
  logoType,
  contentType,
  logoName,
  id,
  queryParams,
}: {
  client: JiraClient
  parents: InstanceElement[]
  logoType: ObjectType
  contentType: string
  logoName: string
  id: number
  queryParams: QueryParamsType
}): Promise<InstanceElement> => {
  const link = `/rest/api/3/universal_avatar/view/type/issuetype/avatar/${id}`
  const logoContent = await getLogoContent(link, client, queryParams)
  const pathName = pathNaclCase(logoName)
  const camelCaseName = convertPathName(pathName)
  const refParents = parents.map(parent => new ReferenceExpression(parent.elemID, parent))
  const logo = new InstanceElement(
    logoName,
    logoType,
    {
      id,
      fileName: `${camelCaseName}.${contentType}`,
      contentType,
      content: new StaticFile({
        filepath: `${JIRA}/${logoType.elemID.name}/${camelCaseName}.${contentType}`,
        content: logoContent,
      }),
    },
    [JIRA, adapterElements.RECORDS_PATH, logoType.elemID.typeName, pathName],
    {
      [CORE_ANNOTATIONS.PARENT]: refParents,
    },
  )
  return logo
}

const sendLogoRequest = async ({
  client,
  change,
  logoInstance,
  url,
}: {
  client: JiraClient
  change: Change<InstanceElement>
  logoInstance: InstanceElement
  url: string
}): Promise<ResponseValue> => {
  const fileContent =
    isAdditionOrModificationChange(change) && isStaticFile(logoInstance.value.content)
      ? await logoInstance.value.content.getContent()
      : undefined
  if (fileContent === undefined) {
    throw new Error(`Failed to fetch attachment content from logo ${logoInstance.elemID.name}`)
  }
  const resp = await client.post({
    url,
    data: fileContent,
    headers: { ...PRIVATE_API_HEADERS, 'Content-Type': 'image/png' },
  })
  return resp
}

const deployLogo = async (change: Change<InstanceElement>, client: JiraClient): Promise<void> => {
  try {
    const logoInstance = getChangeData(change)
    const parent = getParent(logoInstance).value
    const logoUrl = `/rest/api/3/issuetype/${parent.id}/avatar2`
    const resp = await sendLogoRequest({ client, change, logoInstance, url: logoUrl })
    if (!isIssueTypeIconResponse(resp)) {
      throw new Error('Failed to deploy logo to Jira: Invalid response from Jira API')
    }
    await client.put({
      url: `/rest/api/3/issuetype/${parent.id}`,
      data: {
        avatarId: resp.data.id,
        description: parent.description,
        name: parent.name,
      },
    })
    if (isAdditionChange(change)) {
      logoInstance.value.id = resp.data.id
    }
  } catch (e) {
    throw new Error(`Failed to deploy logo to Jira: ${e.message}`)
  }
}

const filter: FilterCreator = ({ client }) => ({
  name: 'issueTypeIconFilter',
  onFetch: async elements => {
    const issueTypes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)

    const logoType = createIconType()
    setTypeDeploymentAnnotations(logoType)
    await addAnnotationRecursively(logoType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(logoType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(logoType, CORE_ANNOTATIONS.DELETABLE)
    elements.push(logoType)
    const errors: SaltoError[] = []
    try {
      await Promise.all(
        issueTypes.map(async issueType => {
          const queryParams = {
            foramt: 'png',
          }
          const logo = await getLogo({
            client,
            parents: [issueType],
            logoType,
            contentType: 'png',
            logoName: `${issueType.elemID.name}`,
            id: issueType.value.avatarId,
            queryParams,
          })
          elements.push(logo)
          return undefined
        }),
      )
    } catch (e) {
      errors.push({ message: e.message, severity: 'Error' })
    }
    return { errors }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [logoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ISSUE_TYPE_ICON_NAME,
    )

    const deployResult = await deployChanges(logoChanges, async change => {
      if (isRemovalChange(change)) {
        // Will get here only if the issue type was removed as well.
        return
      }
      await deployLogo(change, client)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
