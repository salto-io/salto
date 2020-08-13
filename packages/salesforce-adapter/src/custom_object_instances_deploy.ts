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
  InstanceElement, isAdditionGroup, isRemovalGroup,
  ChangeGroupId, ModificationChange, isModificationGroup,
} from '@salto-io/adapter-api'
import { BatchResultInfo } from 'jsforce-types'
import {
  isInstanceOfCustomObject, instancesToCreateRecords, apiName, instancesToDeleteRecords,
  instancesToUpdateRecords,
} from './transformers/transformer'
import SalesforceClient from './client/client'
import * as constants from './constants'
import { Filter } from './filter'

const { isDefined } = values

const getErrorMessagesFromResults = (results: BatchResultInfo[]): string[] =>
  results
    .filter(result => !result.success)
    .flatMap(erroredResult => erroredResult.errors)
    .filter(isDefined)

const deployAddInstances = async (
  instances: InstanceElement[],
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  const results = await client.bulkLoadOperation(
    apiName(instances[0].type),
    'insert',
    instancesToCreateRecords(instances)
  )
  const successInstances = instances
    .filter((_instance, index) => results[index]?.success)
  successInstances.forEach((instance, index) => {
    instance.value[constants.CUSTOM_OBJECT_ID_FIELD] = results[index].id
  })
  const errors = getErrorMessagesFromResults(results)
  await Promise.all(
    successInstances.map(postInstance => filtersRunner.onAdd(postInstance))
  )
  return {
    appliedChanges: successInstances.map(instance => ({ action: 'add', data: { after: instance } })),
    errors: errors.map(error => new Error(error)),
  }
}

const deployRemoveInstances = async (
  instances: InstanceElement[],
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  const results = await client.bulkLoadOperation(
    apiName(instances[0].type),
    'delete',
    instancesToDeleteRecords(instances),
  )
  const successResultIds = results.filter(result => result.success).map(result => result.id)
  const errorMessages = getErrorMessagesFromResults(results)
  const successInstances = instances.filter(instance =>
    successResultIds.includes(instance.value[constants.CUSTOM_OBJECT_ID_FIELD]))
  await Promise.all(successInstances.map(element => filtersRunner.onRemove(element)))
  return {
    appliedChanges: successInstances.map(instance => ({ action: 'remove', data: { before: instance } })),
    errors: errorMessages.map(error => new Error(error)),
  }
}

const deployModifyChanges = async (
  changes: Readonly<ModificationChange<InstanceElement>[]>,
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  const changesData = changes
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
  const resultsErrorMessages = getErrorMessagesFromResults(results)
  const successData = validData
    .filter(changeData =>
      successResultIds.includes(apiName(changeData.after)))
  await Promise.all(
    successData
      .map(changeData =>
        filtersRunner.onUpdate(changeData.before, changeData.after, changes))
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
    const instances = changeGroup.changes.map(change => getChangeElement(change))
    const instanceTypes = [...new Set(instances.map(inst => apiName(inst.type)))]
    if (instanceTypes.length > 1) {
      throw new Error(`Custom Object Instances change group should have a single type but got: ${instanceTypes}`)
    }
    if (isAdditionGroup(changeGroup)) {
      return await deployAddInstances(instances, client, filtersRunner)
    }
    if (isRemovalGroup(changeGroup)) {
      return await deployRemoveInstances(instances, client, filtersRunner)
    }
    if (isModificationGroup(changeGroup)) {
      return await deployModifyChanges(changeGroup.changes, client, filtersRunner)
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
