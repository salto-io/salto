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

import { BuiltinTypes, CORE_ANNOTATIONS, Change, ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile, getChangeData, isAdditionOrModificationChange, isInstanceElement, isStaticFile } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParent, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { ResponseValue } from '@salto-io/adapter-components/src/client'
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

const createIconType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, ISSUE_TYPE_ICON_NAME),
    fields: {
      id: {
        refType: BuiltinTypes.NUMBER,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      content: { refType: BuiltinTypes.STRING },
      contentType: { refType: BuiltinTypes.STRING },
      fileName: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, adapterElements.TYPES_PATH, adapterElements.SUBTYPES_PATH, ISSUE_TYPE_ICON_NAME],
  })

const getLogoContent = async (link: string, client: JiraClient): Promise<Buffer | Error> => {
  try {
    const res = await client.getSinglePage({ url: link, responseType: 'arraybuffer' })
    const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
    if (!Buffer.isBuffer(content)) {
      return new Error('Received invalid response from Jira API for attachment content')
    }
    return content
  } catch (e) {
    return new Error('Failed to fetch attachment content from Jira API')
  }
}

const getLogo = async ({
  client,
  parents,
  logoType,
  contentType,
  logoName,
  link,
  id,
}:{
    client: JiraClient
    parents: InstanceElement[]
    logoType: ObjectType
    contentType: string
    logoName: string
    link: string
    id: number
  }):
  Promise<InstanceElement | Error> => {
  const logoContent = await getLogoContent(link, client)
  if (logoContent instanceof Error) {
    return logoContent
  }
  const pathName = pathNaclCase(logoName)
  const resourcePathName = logoName
  const refParents = parents.map(parent => new ReferenceExpression(parent.elemID, parent))
  const logo = new InstanceElement(
    logoName,
    logoType,
    {
      id,
      fileName: `${logoName}.${contentType}`,
      contentType,
      content: new StaticFile({
        filepath: `${JIRA}/${logoType.elemID.name}/${resourcePathName}.${contentType}`,
        content: logoContent,
      }),
    },
    [JIRA, adapterElements.RECORDS_PATH, logoType.elemID.typeName, pathName],
    {
      [CORE_ANNOTATIONS.PARENT]: refParents,
    }
  )
  return logo
}

const sendLogoRequest = async ({
  client,
  change,
  logoInstance,
  url,
}:{
  client: JiraClient
  change: Change<InstanceElement>
  logoInstance: InstanceElement
  url: string
}): Promise<ResponseValue> => {
  const fileContent = isAdditionOrModificationChange(change)
  && isStaticFile(logoInstance.value.content)
    ? await logoInstance.value.content.getContent()
    : undefined

  const resp = await client.post({
    url,
    data: fileContent,
    headers: { ...PRIVATE_API_HEADERS, 'Content-Type': 'image/png' },
  })
  return resp
}

export const deployLogo = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const logoInstance = getChangeData(change)
  const parent = getParent(logoInstance).value
  const logoUrl = `/rest/api/3/issuetype/${parent.id}/avatar2`
  const resp = await sendLogoRequest(
    { client, change, logoInstance, url: logoUrl }
  ) as IssueTypeIconResponse
  await client.put({
    url: `/rest/api/3/issuetype/${parent.id}`,
    data: {
      avatarId: resp.data.id,
      description: parent.description,
      name: parent.name,
    },
  })
}

const filter: FilterCreator = ({ client }) => ({
  name: 'issueTypeIconFilter',
  onFetch: async elements => {
    const issueTypes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)

    const logoType = createIconType()
    elements.push(logoType)
    await Promise.all(issueTypes.map(async issueType => {
      const url = `/rest/api/3/universal_avatar/view/type/issuetype/avatar/${issueType.value.avatarId}?format=png`
      const logo = await getLogo({
        client,
        parents: [issueType],
        logoType,
        contentType: 'png',
        logoName: `${issueType.elemID.name}Icon`,
        link: url,
        id: issueType.value.avatarId,
      })
      if (logo instanceof Error) {
        return logo
      }
      elements.push(logo)
      return undefined
    }))
    await addAnnotationRecursively(logoType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(logoType, CORE_ANNOTATIONS.UPDATABLE)
    setTypeDeploymentAnnotations(logoType)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [logoChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ISSUE_TYPE_ICON_NAME
    )

    const deployResult = await deployChanges(
      logoChanges,
      async change => deployLogo(change, client)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
