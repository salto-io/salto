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
import _ from 'lodash'
import { Change, InstanceElement, isInstanceChange, getChangeData, isRemovalChange, isAdditionChange, isAdditionOrModificationChange, AdditionChange, ModificationChange, isModificationChange } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { values, collections } from '@salto-io/lowerdash'
import { GROUP_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange, deployEdges } from '../deployment'

const { isDefined } = values
const { awu } = collections.asynciterable

const isStringArray = (
  value: unknown,
): value is string[] => _.isArray(value) && value.every(_.isString)

const GROUP_ASSIGNMENT_FIELDS: Record<string, configUtils.DeploymentRequestsByAction> = {
  users: {
    add: {
      url: '/api/v1/groups/{source}/users/{target}',
      method: 'put',
    },
    remove: {
      url: '/api/v1/groups/{source}/users/{target}',
      method: 'delete',
    },
  },
  apps: {
    add: {
      url: '/api/v1/apps/{target}/groups/{source}',
      method: 'put',
    },
    remove: {
      url: '/api/v1/apps/{target}/groups/{source}',
      method: 'delete',
    },
  },
  roles: {
    remove: {
      url: '/api/v1/groups/{source}/roles/{target}',
      method: 'delete',
    },
  },
}

const getValuesToAdd = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  fieldName: string,
): string[] => {
  const fieldValuesAfter = _.get(getChangeData(change).value, fieldName)
  if (!isStringArray(fieldValuesAfter)) {
    return []
  }
  if (isAdditionChange(change)) {
    return fieldValuesAfter
  }
  const fieldValuesBefore = _.get(change.data.before.value, fieldName)
  if (isStringArray(fieldValuesBefore)) {
    return fieldValuesAfter.filter(val => !fieldValuesBefore.includes(val))
  } if (!isDefined(fieldValuesBefore)) {
    return fieldValuesAfter
  }
  return []
}

const getValuesToRemove = (
  change: ModificationChange<InstanceElement>,
  fieldName: string,
): string[] => {
  const fieldValuesBefore = _.get(change.data.before.value, fieldName)
  const fieldValuesAfter = _.get(change.data.after.value, fieldName)
  if (!isStringArray(fieldValuesBefore)) {
    return []
  }
  if (!isDefined(fieldValuesAfter)) {
    return fieldValuesBefore
  }
  if (isStringArray(fieldValuesAfter)) {
    return fieldValuesBefore.filter(val => !fieldValuesAfter.includes(val))
  }
  return []
}

// Deploy group-app, group-user and group-role assignments
const deployGroupEdges = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  deployRequestByField: Record<string, configUtils.DeploymentRequestsByAction>,
  client: OktaClient,
): Promise<void> => {
  const groupId = getChangeData(change).value.id
  await awu(Object.keys(deployRequestByField)).forEach(async fieldName => {
    const fieldValuesToAdd = getValuesToAdd(change, fieldName)
    const addConfig = deployRequestByField[fieldName].add
    if (fieldValuesToAdd.length > 0 && isDefined(addConfig)) {
      await deployEdges(groupId, fieldValuesToAdd, client, addConfig)
    }

    if (isModificationChange(change)) {
      const fieldValuesToRemove = getValuesToRemove(change, fieldName)
      const removeConfig = deployRequestByField[fieldName].remove
      if (fieldValuesToRemove.length > 0 && isDefined(removeConfig)) {
        await deployEdges(groupId, fieldValuesToRemove, client, removeConfig)
      }
    }
  })
}

const deployGroup = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  config: OktaConfig,
): Promise<void> => {
  const fieldsToIgnore = [
    ...Object.keys(GROUP_ASSIGNMENT_FIELDS),
    // TODO remove this once we update addDeploymentAnnotationsFromSwagger
    'id', 'created', 'lastUpdated', 'objectClass', 'type', '_links', '_embedded', 'lastMembershipUpdated',
  ]
  if (isRemovalChange(change)) {
    fieldsToIgnore.push('profile')
  }
  await defaultDeployChange(change, client, config[API_DEFINITIONS_CONFIG], fieldsToIgnore)
  if (isAdditionOrModificationChange(change)) {
    await deployGroupEdges(change, GROUP_ASSIGNMENT_FIELDS, client)
  }
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
            && getChangeData(change).elemID.typeName === GROUP_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => deployGroup(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
