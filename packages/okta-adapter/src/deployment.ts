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
import _ from 'lodash'
import { Change, ChangeDataType, DeployResult, getChangeData, InstanceElement, isAdditionChange, isModificationChange, isEqualValues, ModificationChange, AdditionChange } from '@salto-io/adapter-api'
import { config as configUtils, deployment, elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import OktaClient from './client/client'

const log = logger(module)

const { awu } = collections.asynciterable
const { isDefined } = values

const isStringArray = (
  value: unknown,
): value is string[] => _.isArray(value) && value.every(_.isString)

/**
 * Deploy change with the standard "add", "modify", "remove" endpoints
 */
export const defaultDeployChange = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  apiDefinitions: configUtils.AdapterApiConfig,
  fieldsToIgnore?: string[],
  queryParams?: Record<string, string>,
): Promise<deployment.ResponseResult> => {
  const changeToDeploy = await elementUtils.swagger.flattenAdditionalProperties(
    _.cloneDeep(change)
  )

  if (isModificationChange(changeToDeploy)) {
    const valuesBefore = (await deployment.filterIgnoredValues(
      changeToDeploy.data.before.clone(),
      fieldsToIgnore ?? [],
      [],
    )).value
    const valuesAfter = (await deployment.filterIgnoredValues(
      changeToDeploy.data.after.clone(),
      fieldsToIgnore ?? [],
      [],
    )).value

    if (isEqualValues(valuesBefore, valuesAfter)) {
      return undefined
    }
  }

  const { deployRequests } = apiDefinitions.types[getChangeData(change).elemID.typeName]
  try {
    const response = await deployment.deployChange({
      change: changeToDeploy,
      client,
      endpointDetails: deployRequests,
      fieldsToIgnore,
      queryParams,
    })

    if (isAdditionChange(change)) {
      if (!Array.isArray(response)) {
        const serviceIdField = apiDefinitions.types[getChangeData(change).elemID.typeName]?.transformation?.serviceIdField ?? 'id'
        if (response?.[serviceIdField] !== undefined) {
          getChangeData(change).value[serviceIdField] = response[serviceIdField]
        }
      } else {
        log.warn('Received unexpected response from deployChange: %o', response)
      }
    }
    return response
  } catch (err) {
    const errorMessage = `Deployment of instance ${getChangeData(change).elemID.getFullName()} failed: ${err}`
    throw new Error(errorMessage)
  }
}

const getValuesToAdd = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  fieldName: string,
): string[] | undefined => {
  const fieldValuesAfter = _.get(getChangeData(change).value, fieldName)
  if (isModificationChange(change)) {
    const fieldValuesBefore = _.get(change.data.before.value, fieldName)
    if (fieldValuesBefore !== undefined) {
      if (isStringArray(fieldValuesAfter) && isStringArray(fieldValuesBefore)) {
        return fieldValuesAfter.filter(val => !fieldValuesBefore.includes(val))
      }
      if (fieldValuesBefore === fieldValuesAfter) {
        return undefined
      }
    }
  }
  return _.isString(fieldValuesAfter) ? [fieldValuesAfter] : fieldValuesAfter
}

const getValuesToRemove = (
  change: ModificationChange<InstanceElement>,
  fieldName: string,
): string[] | undefined => {
  const fieldValuesBefore = _.get(change.data.before.value, fieldName)
  const fieldValuesAfter = _.get(change.data.after.value, fieldName)
  if (isStringArray(fieldValuesBefore)) {
    if (isStringArray(fieldValuesAfter)) {
      return fieldValuesBefore.filter(val => !fieldValuesAfter.includes(val))
    }
    return fieldValuesBefore
  }
  return undefined
}

export const deployEdges = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  deployRequestByField: Record<string, configUtils.DeploymentRequestsByAction>,
  client: OktaClient,
): Promise<void> => {
  const instance = getChangeData(change)
  const instanceId = instance.value.id

  const deployEdge = async (
    paramValues: Record<string, string>,
    deployRequest: configUtils.DeployRequestConfig,
    fieldName: string,
  ): Promise<deployment.ResponseResult> => {
    const url = elementUtils.replaceUrlParams(deployRequest.url, paramValues)
    try {
      const response = await client[deployRequest.method]({ url, data: {} })
      return response.data
    } catch (err) {
      // TODO handle error better
      throw new Error(`Deploy values of ${fieldName} in instance ${instance.elemID.getFullName()} failed`)
    }
  }

  await awu(Object.keys(deployRequestByField)).forEach(async fieldName => {
    const fieldValuesToAdd = getValuesToAdd(change, fieldName)
    const addConfig = deployRequestByField[fieldName].add
    if (isDefined(fieldValuesToAdd) && isDefined(addConfig)) {
      await awu(fieldValuesToAdd).forEach(fieldValue =>
        deployEdge({ source: instanceId, target: fieldValue }, addConfig, fieldName))
    }

    if (isModificationChange(change)) {
      const fieldValuesToRemove = getValuesToRemove(change, fieldName)
      const removeConfig = deployRequestByField[fieldName].remove
      if (isDefined(fieldValuesToRemove) && isDefined(removeConfig)) {
        await awu(fieldValuesToRemove).forEach(fieldValue =>
          deployEdge({ source: instanceId, target: fieldValue }, removeConfig, fieldName))
      }
    }
  })
}

// TODO SALTO-2742 move to adapter components
export const deployChanges = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void | T[]>
): Promise<DeployResult> => {
  const result = await Promise.all(
    changes.map(async change => {
      try {
        const res = await deployChangeFunc(change)
        return res !== undefined ? res : change
      } catch (err) {
        if (!_.isError(err)) {
          throw err
        }
        return err
      }
    })
  )

  const [errors, appliedChanges] = _.partition(result.flat(), _.isError)
  return { errors, appliedChanges }
}
