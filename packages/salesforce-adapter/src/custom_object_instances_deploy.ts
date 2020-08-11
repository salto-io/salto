/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { values } from '@salto-io/lowerdash'
import {
  ChangeGroup, getChangeElement, DeployResult, Change,
  InstanceElement, isAdditionGroup, isRemovalGroup, isModificationGroup, isInstanceChange,
  ChangeGroupId, ModificationChange, RemovalChange, AdditionChange,
} from '@salto-io/adapter-api'
import {
  isInstanceOfCustomObject, instancesToCreateRecords, apiName, instancesToDeleteRecords,
  instancesToUpdateRecords,
} from './transformers/transformer'
import SalesforceClient from './client/client'
import * as constants from './constants'
import { Filter } from './filter'

const { isDefined } = values

const validateSingleTypedGroup = (changeGroup: {
  groupID: ChangeGroupId
  changes: ReadonlyArray<Change<InstanceElement>>
}): void => {
  const instances = changeGroup.changes.map(change => getChangeElement(change))
  if (instances.length === 0) {
    return
  }
  const instancesType = apiName(instances[0].type)
  if (!instances.every(instance => apiName(instance.type) === instancesType)) {
    throw new Error('Custom Object Instances change group should have a single type')
  }
}

const deployAdditionGroup = async (
  changeGroup: ChangeGroup<AdditionChange<InstanceElement>>,
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  validateSingleTypedGroup(changeGroup)
  const instances = changeGroup.changes.map(change => getChangeElement(change))
  const result = await client.bulkLoadOperation(
    apiName(instances[0].type),
    'insert',
    instancesToCreateRecords(instances)
  )
  const successInstances = instances
    .filter((_instance, index) => result[index] !== undefined && result[index].success)
  successInstances.forEach((instance, index) => {
    instance.value[constants.CUSTOM_OBJECT_ID_FIELD] = result[index].id
  })
  const errors = result
    .filter(r => !r.success)
    .flatMap(erroredResult => erroredResult.errors).filter(isDefined)
  await Promise.all(
    successInstances.map(async postInstance => filtersRunner.onAdd(postInstance))
  )
  return {
    appliedChanges: successInstances.map(instance => ({ action: 'add', data: { after: instance } })),
    errors: errors.map(error => new Error(error)),
  }
}

const deployRemovalGroup = async (
  removalInstGroup: ChangeGroup<RemovalChange<InstanceElement>>,
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  validateSingleTypedGroup(removalInstGroup)
  const instances = removalInstGroup.changes.map(change => getChangeElement(change))
  const results = await client.bulkLoadOperation(
    apiName(instances[0].type),
    'delete',
    instancesToDeleteRecords(instances),
  )
  const successResultIds = results.filter(result => result.success).map(result => result.id)
  const errorMessages = results
    .filter(result => !result.success)
    .flatMap(erroredResult => erroredResult.errors)
    .filter(isDefined)
  const successInstances = instances.filter(instance =>
    successResultIds.includes(instance.value[constants.CUSTOM_OBJECT_ID_FIELD]))
  await Promise.all(successInstances.map(async element => filtersRunner.onRemove(element)))
  return {
    appliedChanges: successInstances.map(instance => ({ action: 'remove', data: { before: instance } })),
    errors: errorMessages.map(error => new Error(error)),
  }
}

const deployModifyGroup = async (
  modifyInstGroup: ChangeGroup<ModificationChange<InstanceElement>>,
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  validateSingleTypedGroup(modifyInstGroup)
  const changesData = modifyInstGroup.changes
    .filter(isInstanceChange)
    .map(change => change.data)
  const instancesType = apiName(changesData[0].after.type)
  const [validData, diffApiNameData] = _.partition(
    changesData,
    changeData => apiName(changeData.before) === apiName(changeData.after)
  )
  const afters = validData.map(data => data.after)
  const results = await client.bulkLoadOperation(
    instancesType,
    'update',
    instancesToUpdateRecords(afters)
  )
  const successResultIds = results.filter(result => result.success).map(result => result.id)
  const resultsErrorMessages = results
    .filter(result => !result.success)
    .flatMap(erroredResult => erroredResult.errors)
    .filter(isDefined)
  const successData = validData
    .filter(changeData =>
      successResultIds.includes(apiName(changeData.after)))
  await Promise.all(
    successData
      .map(async changeData =>
        filtersRunner.onUpdate(changeData.before, changeData.after, modifyInstGroup.changes))
  )
  const diffApiNameErrors = diffApiNameData.map(data => new Error(`Failed to update as api name prev=${apiName(
    data.before
  )} and new=${apiName(data.after)} are different`))
  const errors = resultsErrorMessages.map(error => new Error(error)).concat(diffApiNameErrors)
  return {
    appliedChanges: successData.map(data => ({ action: 'modify', data })),
    errors,
  }
}

export const isCustomObjectInstancesGroup = (changeGroup: ChangeGroup): changeGroup is {
  groupID: ChangeGroupId
  changes: ReadonlyArray<Change<InstanceElement>>
  } =>
  changeGroup.changes.every(change => isInstanceOfCustomObject(getChangeElement(change)))

export const deployCustomObjectInstancesGroup = async (
  changeGroup: {
    groupID: ChangeGroupId
    changes: ReadonlyArray<Change<InstanceElement>>
    },
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  try {
    if (isAdditionGroup(changeGroup)) {
      return await deployAdditionGroup(changeGroup, client, filtersRunner)
    }
    if (isRemovalGroup(changeGroup)) {
      return await deployRemovalGroup(changeGroup, client, filtersRunner)
    }
    if (isModificationGroup(changeGroup)) {
      return await deployModifyGroup(changeGroup, client, filtersRunner)
    }
    return {
      appliedChanges: [],
      errors: [new Error('Custom Object Instances change group must have one action')],
    }
  } catch (error) {
    return {
      appliedChanges: [],
      errors: [error],
    }
  }
}
