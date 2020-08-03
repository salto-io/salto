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
import { values } from '@salto-io/lowerdash'
import {
  ChangeGroup, getChangeElement, DeployResult, Element,
  InstanceElement, isAdditionGroup, isRemovalGroup, isModificationGroup, isInstanceChange,
} from '@salto-io/adapter-api'
import {
  isInstanceOfCustomObject, instancesToCreateRecords, apiName, instancesToDeleteRecords,
  instancesToUpdateRecords,
} from './transformers/transformer'
import SalesforceClient from './client/client'
import * as constants from './constants'
import { Filter } from './filter'

const { isDefined } = values

const addOperation = 'insert'
const modifyOperation = 'update'
const removalOperation = 'delete'


// TODO: Extract this somewhere cause this is a duplicate
const validateApiName = (prevElement: Element, newElement: Element): void => {
  if (apiName(prevElement) !== apiName(newElement)) {
    throw Error(
      `Failed to update element as api names prev=${apiName(
        prevElement
      )} and new=${apiName(newElement)} are different`
    )
  }
}

const addInstances = async (
  client: SalesforceClient,
  type: string,
  instances: InstanceElement[]
): Promise<{ successInstances: InstanceElement[]; errors: string[] }> => {
  const result = await client.bulkLoadOperation(
    type,
    addOperation,
    instancesToCreateRecords(instances)
  )
  instances.forEach((instance, index) => {
    if (result[index] !== undefined && result[index].success) {
      instance.value[constants.CUSTOM_OBJECT_ID_FIELD] = result[index].id
    }
  })
  const successInstances = instances
    .filter(instance => instance.value[constants.CUSTOM_OBJECT_ID_FIELD] !== undefined)
  const errors = result
    .filter(r => !r.success)
    .flatMap(erroredResult => erroredResult.errors).filter(isDefined)
  return { successInstances, errors }
}

export const isCustomObjectInstancesGroup = (changeGroup: ChangeGroup): boolean =>
  changeGroup.changes.every(change => isInstanceOfCustomObject(getChangeElement(change)))

export const deployCustomObjectInstancesGroup = async (
  changeGroup: ChangeGroup,
  client: SalesforceClient,
  filtersRunner: Required<Filter>,
): Promise<DeployResult> => {
  try {
    if (isAdditionGroup(changeGroup)) {
      const instances = changeGroup.changes
        .map(change => getChangeElement(change)) as InstanceElement[]
      const instancesType = apiName(instances[0].type)
      if (!instances.every(instance => apiName(instance.type) === instancesType)) {
        return {
          appliedChanges: [],
          errors: [new Error('Custom Object Instances change group of Add should have a single type')],
        }
      }
      const { successInstances, errors } = await addInstances(
        client,
        instancesType,
        instances
      )
      await Promise.all(
        successInstances.map(async postInstance => filtersRunner.onAdd(postInstance))
      )
      return {
        appliedChanges: successInstances.map(instance => ({ action: 'add', data: { after: instance } })),
        errors: errors.map(error => new Error(error)),
      }
    }
    if (isRemovalGroup(changeGroup)) {
      const instances = changeGroup.changes
        .map(change => getChangeElement(change)) as InstanceElement[]
      const instancesType = apiName(instances[0].type)
      if (!instances.every(instance => apiName(instance.type) === instancesType)) {
        return {
          appliedChanges: [],
          errors: [new Error('Custom Object Instances change group of Removal should have a single type')],
        }
      }
      const results = await client.bulkLoadOperation(
        instancesType,
        removalOperation,
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
        appliedChanges: changeGroup.changes,
        errors: errorMessages.map(error => new Error(error)),
      }
    }
    if (isModificationGroup(changeGroup)) {
      const changesData = changeGroup.changes
        .filter(isInstanceChange)
        .map(change => change.data as { before: InstanceElement; after: InstanceElement })
      changesData.forEach(data => validateApiName(data.before, data.after))
      const instancesType = apiName(changesData[0].before.type)
      if (!changesData.every(data =>
        (apiName(data.after.type) === instancesType)
        && (apiName(data.before.type) === instancesType))
      ) {
        return {
          appliedChanges: [],
          errors: [new Error('Custom Object Instances change group of Modify should have a single type')],
        }
      }
      const afters = changesData.map(data => data.after)
      const results = await client.bulkLoadOperation(
        instancesType,
        modifyOperation,
        instancesToUpdateRecords(afters)
      )
      const successResultIds = results.filter(result => result.success).map(result => result.id)
      const errorMessages = results
        .filter(result => !result.success)
        .flatMap(erroredResult => erroredResult.errors)
        .filter(isDefined)
      const successData = changesData
        .filter(changeData =>
          successResultIds.includes(changeData.after.value[constants.CUSTOM_OBJECT_ID_FIELD]))
      await Promise.all(
        successData
          .map(async changsData =>
            filtersRunner.onUpdate(changsData.before, changsData.after, changeGroup.changes))
      )
      return {
        appliedChanges: successData.map(data => ({ action: 'modify', data })),
        errors: errorMessages.map(error => new Error(error)),
      }
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
