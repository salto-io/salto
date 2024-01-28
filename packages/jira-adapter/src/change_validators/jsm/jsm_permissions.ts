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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'
import { JSM_DUCKTYPE_SUPPORTED_TYPES } from '../../config/api_config'

const { awu } = collections.asynciterable
const { createPaginator, getWithCursorPagination } = clientUtils
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const SUPPORTED_TYPES = new Set(Object.keys(JSM_DUCKTYPE_SUPPORTED_TYPES))
/*
* This validator prevents deployment of jsm types when user has no jsm permissions.
*/
export const jsmPermissionsValidator: (
    config: JiraConfig,
    client: JiraClient,
  ) => ChangeValidator = (config, client) => async changes => {
    if (!config.fetch.enableJSM) {
      return []
    }

    const paginator = createPaginator({
      client,
      // Pagination method is different from the rest of jira's API
      paginationFuncCreator: () => getWithCursorPagination(),
    })
    const paginationArgs = {
      url: '/rest/servicedeskapi/servicedesk',
      paginationField: '_links.next',
    }
    const serviceDeskProjectIds = (await toArrayAsync(
      paginator(paginationArgs, page => makeArray(page.values) as clientUtils.ResponseValue[])
    )).flat().map(project => project.projectId)

    return awu(changes)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => SUPPORTED_TYPES.has(instance.elemID.typeName))
      .filter(instance => {
        try {
          const projectParent = getParent(instance)
          return !serviceDeskProjectIds.includes(projectParent.value.id)
        } catch (e) {
          return false
        }
      })
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot deploy athis instance since it is associated to a project without JSM permissions',
        detailedMessage: `Cannot deploy ${instance.elemID.name} since its associated project doesn't have JSM permissions`,
      }))
      .toArray()
  }
