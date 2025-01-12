/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import {
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  Change,
  ChangeDataType,
  Value,
  CORE_ANNOTATIONS,
  Element,
  InstanceElement,
  ModificationChange,
  AdditionChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { resolveChangeElement } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { FILTER_TYPE_NAME, SHARE_PERMISSION_FIELDS } from '../constants'
import { findObject } from '../utils'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { getLookUpName } from '../reference_mapping'

const log = logger(module)
const { makeArray } = collections.array
const USER = 'user'

type Permission = {
  type: string
  user: Value
}

const USER_PERMISSION_SCHEME = Joi.object({
  type: Joi.string().valid(USER).required(),
  user: Joi.any().required(),
})

const isUserPermission = createSchemeGuard<Permission>(USER_PERMISSION_SCHEME)

type ChangeFormatFunction = (permission: Permission) => void

const toDeploymentFormat = (permission: Permission): void => {
  permission.user = {
    accountId: permission.user,
  }
}

const toNaclFormat = (permission: Permission): void => {
  permission.user = permission.user.accountId
}

const changePermissionFieldFormat = (changes: Change<ChangeDataType>[], changeFunction: ChangeFormatFunction): void => {
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FILTER_TYPE_NAME)
    .forEach(instance => {
      SHARE_PERMISSION_FIELDS.forEach(fieldName => {
        makeArray(instance.value[fieldName]).filter(isUserPermission).forEach(changeFunction)
      })
    })
}

// handles the permissions format change. The share permission is not relevant for dc, as there is no option for it thereimport { FILTER_TYPE_NAME } from '../constants'

const deployOwner = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)
  const beforeOwnerAccountId = isModificationChange(resolvedChange)
    ? resolvedChange.data.before.value.owner.id
    : undefined
  const afterOwnerAccountId = resolvedChange.data.after.value.owner

  const instance = getChangeData(change)
  if (beforeOwnerAccountId !== afterOwnerAccountId) {
    await client.put({
      url: `/rest/api/3/filter/${instance.value.id}/owner`,
      data: {
        accountId: afterOwnerAccountId,
      },
    })
  }
}

const deployFilter = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: ['owner'],
  })

  await deployOwner(change, client)
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'filtersFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const filterType = findObject(elements, FILTER_TYPE_NAME)
    if (filterType === undefined) {
      log.warn('filterType type was not found')
      return
    }
    filterType.fields.owner.annotations = {
      [CORE_ANNOTATIONS.CREATABLE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: true,
    }
  },
  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changePermissionFieldFormat(changes, toDeploymentFormat)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionOrModificationChange(change) &&
        getChangeData(change).elemID.typeName === FILTER_TYPE_NAME,
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange).filter(isAdditionOrModificationChange),
      async change => deployFilter(change, client, config),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
  onDeploy: async (changes: Change<ChangeDataType>[]) => {
    changePermissionFieldFormat(changes, toNaclFormat)
  },
})

export default filter
