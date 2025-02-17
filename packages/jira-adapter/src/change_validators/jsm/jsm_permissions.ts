/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeValidator,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'
import {
  REQUEST_TYPE_NAME,
  QUEUE_TYPE,
  PORTAL_GROUP_TYPE,
  CALENDAR_TYPE,
  PORTAL_SETTINGS_TYPE_NAME,
  SLA_TYPE_NAME,
  FORM_TYPE,
  PROJECT_TYPE,
} from '../../constants'
import { isJsmEnabledInService } from '../../filters/account_info'

const { awu } = collections.asynciterable
const { createPaginator, getWithCursorPagination } = clientUtils
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const SUPPORTED_TYPES = new Set([
  REQUEST_TYPE_NAME,
  QUEUE_TYPE,
  PORTAL_GROUP_TYPE,
  CALENDAR_TYPE,
  PORTAL_SETTINGS_TYPE_NAME,
  SLA_TYPE_NAME,
  FORM_TYPE,
])

const getAdditionChangedProjectsNames = (changes: ReadonlyArray<Change>): string[] =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
    .map(instance => instance.elemID.getFullName())

/*
 * This validator prevents deployment of jsm types when user has no jsm permissions.
 */
export const jsmPermissionsValidator: (config: JiraConfig, client: JiraClient) => ChangeValidator =
  (config, client) => async changes => {
    if (!config.fetch.enableJSM) {
      return []
    }
    const isJsmEnabled = await isJsmEnabledInService(client)
    if (!isJsmEnabled) {
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
    const serviceDeskProjectIds = (
      await toArrayAsync(paginator(paginationArgs, page => makeArray(page.values) as clientUtils.ResponseValue[]))
    )
      .flat()
      .map(project => project.projectId)

    return (
      awu(changes)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => SUPPORTED_TYPES.has(instance.elemID.typeName))
        .filter(instance => hasValidParent(instance))
        // We don't need to check for permissions if we are also deploying the project itself
        .filter(
          instance => !getAdditionChangedProjectsNames(changes).includes(getParent(instance).elemID.getFullName()),
        )
        .filter(instance => !serviceDeskProjectIds.includes(getParent(instance).value.id))
        .map(instance => ({
          elemID: instance.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Lacking permissions to update a JSM project',
          detailedMessage: `Cannot deploy ${instance.elemID.name} since it is part of a project to which you do not have permissions to. Add user to project's permissions and try again.`,
        }))
        .toArray()
    )
  }
