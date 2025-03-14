/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  Change,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isMapType,
  isModificationChange,
  isObjectType,
  isRemovalOrModificationChange,
  ModificationChange,
  ObjectType,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard, naclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import { resolveChangeElement, client as clientUtils } from '@salto-io/adapter-components'

import { logger } from '@salto-io/logging'
import { defaultDeployChange } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'
import { getLookUpName } from '../../reference_mapping'
import { getDiffIds } from '../../diff'

const { awu } = collections.asynciterable

const log = logger(module)

export const SCREEN_TAB_TYPE_NAME = 'ScreenableTab'

type ScreenTabError = {
  data: {
    errors?: { [key: string]: string }
  }
}

const ScreenTabErrorScheme = Joi.object({
  data: Joi.object({
    errors: Joi.object(),
  })
    .required()
    .unknown(true),
})
  .required()
  .unknown(true)

const isScreenTabError = createSchemeGuard<ScreenTabError>(ScreenTabErrorScheme)

const deployTabFieldsRemoval = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  parentScreenId: string,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  const fieldsAfter = resolvedChange.data.after.value.fields ?? []
  const fieldsBefore = isModificationChange(resolvedChange) ? resolvedChange.data.before.value.fields ?? [] : []

  const { removedIds } = getDiffIds(fieldsBefore, fieldsAfter)
  const tabId = getChangeData(resolvedChange).value.id

  // Running this in parallel might cause a bug later when reoordering the fields. See SALTO-3357
  await awu(removedIds).forEach(id =>
    client.delete({
      url: `/rest/api/3/screens/${parentScreenId}/tabs/${tabId}/fields/${id}`,
    }),
  )
}

const deployTabFieldsAdditionsAndOrder = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  parentScreenId: string,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  const fieldsAfter = resolvedChange.data.after.value.fields ?? []
  const fieldsBefore = isModificationChange(resolvedChange) ? resolvedChange.data.before.value.fields ?? [] : []

  const { addedIds } = getDiffIds(fieldsBefore, fieldsAfter)
  const tabId = getChangeData(resolvedChange).value.id

  // Running this in parallel might cause a bug later when reoordering the fields. See SALTO-3357
  await awu(addedIds).forEach(async id => {
    try {
      await client.post({
        url: `/rest/api/3/screens/${parentScreenId}/tabs/${tabId}/fields`,
        data: {
          fieldId: id,
        },
      })
    } catch (error) {
      // If a field is added to a requestType and the field has a context that includes the relevant issueType that is being
      // used by the requestType, the project screens that are attached to the issueType will be updated with the new field.
      // The above may lead to a failure in this call, we want to suppress those errors
      if (
        error instanceof clientUtils.HTTPError &&
        error.response?.status === 400 &&
        isScreenTabError(error.response) &&
        (error.response as ScreenTabError).data.errors?.fieldId?.includes('already exists on the screen')
      ) {
        log.error(`The field with id ${id} already exists on the screen ${parentScreenId} tab ${tabId}`)
      } else {
        throw error
      }
    }
  })

  if (!_.isEqual(fieldsBefore, fieldsAfter) && fieldsAfter.length > 1) {
    await client.post({
      url: `/rest/api/3/screens/${parentScreenId}/tabs/${tabId}/fields/${fieldsAfter[0]}/move`,
      data: {
        position: 'First',
      },
    })

    await awu(fieldsAfter.slice(1)).forEach(async (fieldId, index) => {
      await client.post({
        url: `/rest/api/3/screens/${parentScreenId}/tabs/${tabId}/fields/${fieldId}/move`,
        data: {
          after: fieldsAfter[index],
        },
      })
    })
  }
}

const deployScreenTab = async (
  change: Change<InstanceElement>,
  parentScreenId: string,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const nameAfter = isAdditionOrModificationChange(change) ? change.data.after.value.name : undefined

  const nameBefore = isRemovalOrModificationChange(change) ? change.data.before.value.name : undefined

  const fieldsToIgnore = ['fields', 'position']

  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore:
      nameAfter === nameBefore
        ? // If we try to deploy a screen tab with the same name,
          // we get an error that the name is already in use
          [...fieldsToIgnore, 'name']
        : fieldsToIgnore,
    additionalUrlVars: {
      screenId: parentScreenId,
    },
  })
}

const createTabInstance = (tabValues: Values, tabType: ObjectType): InstanceElement =>
  new InstanceElement(naclCase(tabValues.name), tabType, tabValues)

const getScreenTabType = async (screenType: ObjectType): Promise<ObjectType> => {
  const tabsMapType = await screenType.fields.tabs?.getType()
  if (!isMapType(tabsMapType)) {
    throw new Error(`Type of ${screenType.fields.tabs.elemID.getFullName()} is not a map type`)
  }

  const tabsType = await tabsMapType.getInnerType()
  if (!isObjectType(tabsType)) {
    throw new Error(`Inner type of ${screenType.fields.tabs.elemID.getFullName()} is not an object type`)
  }

  return tabsType
}

const getTabChanges = (
  screenChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  screenTabType: ObjectType,
): Change<InstanceElement>[] => {
  const tabsAfter = screenChange.data.after.value.tabs ?? {}
  const tabsBefore = isModificationChange(screenChange) ? screenChange.data.before.value.tabs ?? {} : {}

  const additionChanges = Object.keys(tabsAfter)
    .filter(key => tabsBefore[key] === undefined)
    .map(key =>
      toChange({
        after: createTabInstance(tabsAfter[key], screenTabType),
      }),
    )

  const removalChanges = Object.keys(tabsBefore)
    .filter(key => tabsAfter[key] === undefined)
    .map(key =>
      toChange({
        before: createTabInstance(tabsBefore[key], screenTabType),
      }),
    )

  const modificationChanges = Object.keys(tabsBefore)
    .filter(key => tabsAfter[key] !== undefined)
    .map(key =>
      toChange({
        before: createTabInstance(tabsBefore[key], screenTabType),
        after: createTabInstance(tabsAfter[key], screenTabType),
      }),
    )

  return [...additionChanges, ...removalChanges, ...modificationChanges]
}

const getTabsFromService = async (
  change: AdditionChange<InstanceElement>,
  screenTabType: ObjectType,
  client: JiraClient,
): Promise<InstanceElement[]> => {
  const instance = getChangeData(change)
  // At this point because we call this right after the field is created,
  // there is only one tab so no need to paginate here
  const resp = await client.get({ url: `/rest/api/3/screens/${instance.value.id}/tabs` })
  if (!Array.isArray(resp.data) || !resp.data.every(_.isPlainObject)) {
    log.warn(
      `Received unexpected response from Jira when querying tabs for instance ${instance.elemID.getFullName()}: ${safeJsonStringify(resp.data)}`,
    )
    throw new Error(
      `Received unexpected response from Jira when querying tabs for instance ${instance.elemID.getFullName()}`,
    )
  }
  return (resp.data as Values[]).map(tab => new InstanceElement(naclCase(tab.name), screenTabType, tab))
}

export const deployTabs = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const screenTabType = await getScreenTabType(await getChangeData(change).getType())

  const tabsToRemove = isAdditionChange(change) ? await getTabsFromService(change, screenTabType, client) : []

  const tabChanges = [
    // Screen are created with a default tab, so we need to remove it.
    ...tabsToRemove.map(tab => toChange({ before: tab })),
    ...getTabChanges(change, screenTabType),
  ]

  const screenId = getChangeData(change).value.id
  await awu(tabChanges).forEach(tabChange => deployScreenTab(tabChange, screenId, client, config))

  // We first remove the fields from all the tabs because two tabs can't have the same field,
  // so if we will try to add a field before we removed it from other tab we will get an error
  await Promise.all(
    tabChanges
      .filter(isAdditionOrModificationChange)
      .map(tabChange => deployTabFieldsRemoval(tabChange, client, screenId)),
  )

  await Promise.all(
    tabChanges
      .filter(isAdditionOrModificationChange)
      .map(tabChange => deployTabFieldsAdditionsAndOrder(tabChange, client, screenId)),
  )
}
