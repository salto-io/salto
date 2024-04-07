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
import {
  Change,
  ChangeDataType,
  DeployResult,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isEqualValues,
  isModificationChange,
  isSaltoError,
  ReadOnlyElementsSource,
  SaltoElementError,
} from '@salto-io/adapter-api'
import {
  config,
  deployment,
  client as clientUtils,
  elements as elementUtils,
  resolveChangeElement,
  resolveValues,
} from '@salto-io/adapter-components'
import { invertNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { getLookUpName } from '../reference_mapping'

const { awu } = collections.asynciterable

const log = logger(module)

type DeployChangeParam = {
  change: Change<InstanceElement>
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface
  apiDefinitions: config.AdapterApiConfig
  fieldsToIgnore?: string[] | ((path: ElemID) => boolean)
  additionalUrlVars?: Record<string, string>
  elementsSource?: ReadOnlyElementsSource
  serviceIdSetter?: (instance: InstanceElement, serviceIdField: string, response: clientUtils.ResponseValue) => void
}

const invertKeysNames = (instance: Record<string, unknown>): void => {
  Object.keys(instance)
    .filter(key => invertNaclCase(key) !== key)
    .forEach(key => {
      instance[invertNaclCase(key)] = instance[key]
      delete instance[key]
    })
}

export const defaultServiceIdSetter = (
  instance: InstanceElement,
  serviceIdField: string,
  response: clientUtils.ResponseValue,
): void => {
  instance.value[serviceIdField] = response[serviceIdField]
}

/**
 * Deploy change with the standard "add", "modify", "remove" endpoints
 */
export const defaultDeployChange = async ({
  change,
  client,
  apiDefinitions,
  fieldsToIgnore = [],
  additionalUrlVars,
  elementsSource,
  serviceIdSetter = defaultServiceIdSetter,
}: DeployChangeParam): Promise<clientUtils.ResponseValue | clientUtils.ResponseValue[] | undefined> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName, resolveValues, elementsSource)
  invertKeysNames(getChangeData(resolvedChange).value)
  const changeToDeploy = await elementUtils.swagger.flattenAdditionalProperties(resolvedChange, elementsSource)

  if (isModificationChange(changeToDeploy)) {
    const valuesBefore = (
      await deployment.filterIgnoredValues(changeToDeploy.data.before.clone(), fieldsToIgnore, [], elementsSource)
    ).value
    const valuesAfter = (
      await deployment.filterIgnoredValues(changeToDeploy.data.after.clone(), fieldsToIgnore, [], elementsSource)
    ).value

    if (isEqualValues(valuesBefore, valuesAfter)) {
      return undefined
    }
  }

  const response = await deployment.deployChange({
    change: changeToDeploy,
    client,
    endpointDetails: apiDefinitions.types[getChangeData(change).elemID.typeName]?.deployRequests,
    fieldsToIgnore,
    additionalUrlVars,
    elementsSource,
  })

  if (isAdditionChange(change)) {
    if (!Array.isArray(response)) {
      const serviceIdField =
        apiDefinitions.types[getChangeData(change).elemID.typeName]?.transformation?.serviceIdField ?? 'id'
      if (response?.[serviceIdField] !== undefined) {
        serviceIdSetter(change.data.after, serviceIdField, response)
      }
    } else {
      log.warn('Received unexpected response from deployChange: %o', response)
    }
  }
  return response
}

/**
 * Runs a deploy function of a single change on many changes and returns the deploy results
 */
export const deployChanges = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void>,
): Promise<Omit<DeployResult, 'extraProperties'>> => {
  const errors: SaltoElementError[] = []

  const appliedChanges = await awu(changes)
    .map(async change => {
      try {
        await deployChangeFunc(change)
        return change
      } catch (err) {
        if (isSaltoError(err) && err.severity !== 'Error') {
          log.error(
            'An error occurred during deployment of %s: %o',
            getChangeData(change).elemID.getFullName(),
            err.message,
          )
          errors.push({
            message: err.message,
            severity: err.severity,
            elemID: getChangeData(change).elemID,
          })
          return change
        }
        log.error('Deployment of %s failed: %o', getChangeData(change).elemID.getFullName(), err)
        errors.push({
          message: `${err}`,
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        })
        return undefined
      }
    })
    .filter(values.isDefined)
    .toArray()

  return {
    errors,
    appliedChanges,
  }
}
