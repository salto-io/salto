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
import { ChangeValidator, getChangeData, InstanceElement, isInstanceChange, isRemovalChange, SeverityLevel } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'

const { awu } = collections.asynciterable

const log = logger(module)

export const doesProjectHaveIssues = async (
  instance: InstanceElement,
  client: JiraClient
): Promise<boolean> => {
  let response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
  try {
    response = await client.getSinglePage({
      url: '/rest/api/3/search',
      queryParams: {
        jql: `project = "${instance.value.key}"`,
        maxResults: '0',
      },
    })
  } catch (e) {
    log.error(`Received an error Jira search API, ${e.message}. Assuming project ${instance.elemID.getFullName()} has issues.`)
    return true
  }

  if (Array.isArray(response.data) || response.data.total === undefined) {
    log.error(`Received invalid response from Jira search API, ${safeJsonStringify(response.data, undefined, 2)}. Assuming project ${instance.elemID.getFullName()} has issues.`)
    return true
  }

  log.debug(`Project ${instance.elemID.getFullName()} has ${response.data.total} issues.`)

  return response.data.total !== 0
}

export const projectDeletionValidator: (client: JiraClient, config: JiraConfig) =>
  ChangeValidator = (client, config) => async changes => {
    if (config.deploy.forceDelete) {
      log.info('Force delete is enabled, skipping project deletion validator')
      return []
    }

    return awu(changes)
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === 'Project')
      .filter(instance => doesProjectHaveIssues(instance, client))
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Can’t delete Project with existing issues',
        detailedMessage: 'This project has issues assigned to it. Deleting the project will also delete all its issues and Salto will not be able to restore the issues. To delete this project anyway, and delete all its issues, add a "forceDelete=true" deploy option to your deploy configuration.',
      }))
      .toArray()
  }
