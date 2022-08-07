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
import { CORE_ANNOTATIONS, Element, isInstanceElement, isInstanceChange, getChangeData, Change, InstanceElement, isAdditionOrModificationChange, DeployResult, isModificationChange, AdditionChange, ModificationChange, Values, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData, resolveValues } from '@salto-io/adapter-utils'
import { getLookUpName } from '../../reference_mapping'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { STATUS_TYPE_NAME } from '../../constants'
import JiraClient from '../../client/client'

const { awu } = collections.asynciterable

const log = logger(module)
const STATUS_CATEGORY_NAME_TO_ID : Record<string, number> = {
  TODO: 2,
  DONE: 3,
  IN_PROGRESS: 4,
}
const STATUS_CATEGORY_ID_TO_NAME : Record<number, string> = {
  2: 'TODO',
  3: 'DONE',
  4: 'IN_PROGRESS',
}
const STATUS_DEPLOYMENT_LIMIT = 50

const modifyStatuses = async (
  modificationValues: Values[],
  client: JiraClient,
): Promise<void> => {
  await Promise.all(
    _.chunk(modificationValues, STATUS_DEPLOYMENT_LIMIT)
      .map(async statusChunk =>
        client.put({
          url: '/rest/api/3/statuses',
          data: {
            statuses: statusChunk,
          },
        }))
  )
}

const addStatuses = async (
  additionValues: Values[],
  client: JiraClient,
): Promise<void> => {
  await Promise.all(
    _.chunk(additionValues, STATUS_DEPLOYMENT_LIMIT)
      .map(async statusChunk =>
        client.post({
          url: '/rest/api/3/statuses',
          data: {
            scope: {
              type: 'GLOBAL',
            },
            statuses: statusChunk,
          },
        }))
  )
}

const deployStatuses = async (
  changes: Array<AdditionChange<InstanceElement> | ModificationChange<InstanceElement>>,
  client: JiraClient,
): Promise<void> => {
  const [modificationValues, additionValues] = _.partition(changes,
    change => isModificationChange(change))
    .map(changesByType =>
      changesByType
        .map(getChangeData)
        .map(instance => instance.value))

  if (modificationValues.length > 0) {
    await modifyStatuses(modificationValues, client)
  }

  if (additionValues.length > 0) {
    await addStatuses(additionValues, client)
  }
}

const filter: FilterCreator = ({ client, config }) => {
  let statusCategoryReferences: Record<string, ReferenceExpression>
  return {
    onFetch: async (elements: Element[]) => {
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
        .filter(instance => instance.value.statusCategory !== undefined)
        .forEach(instance => {
        // statusCategory has a fixed number of options so we map the statusCategory name to its id
          instance.value.statusCategory = STATUS_CATEGORY_NAME_TO_ID[instance.value.statusCategory]
        ?? instance.value.statusCategory
        })

      if (!config.client.usePrivateAPI) {
        log.debug('Skipping status deployment filter because private API is not enabled')
        return
      }

      const statusType = findObject(elements, STATUS_TYPE_NAME)
      if (statusType === undefined) {
        return
      }

      statusType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
      statusType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      statusType.annotations[CORE_ANNOTATIONS.DELETABLE] = true
      setFieldDeploymentAnnotations(statusType, 'statusCategory')
      setFieldDeploymentAnnotations(statusType, 'description')
      setFieldDeploymentAnnotations(statusType, 'name')
      setFieldDeploymentAnnotations(statusType, 'id')
    },

    preDeploy: async changes => {
      statusCategoryReferences = Object.fromEntries(changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === STATUS_TYPE_NAME)
        .map(change => getChangeData(change))
        .filter(isInstanceElement)
        .filter(instance => isReferenceExpression(instance.value.statusCategory))
        .map(instance =>
          [instance.elemID.getFullName(), _.cloneDeep(instance.value.statusCategory)]))

      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === STATUS_TYPE_NAME)
        .forEach(async change => applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          async instance => {
            const resolvedInstance = await resolveValues(instance, getLookUpName)
            instance.value.statusCategory = STATUS_CATEGORY_ID_TO_NAME[
              resolvedInstance.value.statusCategory
            ]
            return instance
          },
        ))
    },

    deploy: async changes => {
      const [relevantChanges, leftoverChanges] = _.partition(
        changes,
        change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === STATUS_TYPE_NAME
      )

      if (relevantChanges.length === 0) {
        return {
          leftoverChanges,
          deployResult: {
            errors: [],
            appliedChanges: [],
          },
        }
      }

      let deployResult: DeployResult
      try {
        await deployStatuses(
          relevantChanges
            .filter(isInstanceChange)
            .filter(isAdditionOrModificationChange),
          client,
        )
        deployResult = {
          errors: [],
          appliedChanges: relevantChanges,
        }
      } catch (err) {
        deployResult = {
          errors: [err],
          appliedChanges: [],
        }
      }

      return {
        leftoverChanges,
        deployResult,
      }
    },

    onDeploy: async changes => {
      changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === STATUS_TYPE_NAME)
        .forEach(async change => applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          async instance => {
            const originalReference = statusCategoryReferences[instance.elemID.getFullName()]
            instance.value.statusCategory = originalReference
            return instance
          },
        ))
    },
  }
}

export default filter
