/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  InstanceElement,
  SaltoElementError,
  SeverityLevel,
  Value,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { elements as elementUtils, resolveChangeElement, resolveValues } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { SCRIPT_RUNNER_LISTENER_TYPE } from '../../constants'
import { getLookUpName } from '../../reference_mapping'
import { JiraDuckTypeConfig } from '../../config/api_config'
import { listenersAuditSetter } from './script_runner_filter'

const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

const { awu } = collections.asynciterable
const log = logger(module)

type ListenersResponse = {
  values: Value[]
}

const LISTENERS_RESPONSE_SCHEME = Joi.object({
  values: Joi.array().required(),
})
  .required()
  .unknown(true)

const isListenersResponse = createSchemeGuard<ListenersResponse>(
  LISTENERS_RESPONSE_SCHEME,
  'Received an invalid script runner listeners response',
)

const updateAuditData = (changes: Change<InstanceElement>[], response: ListenersResponse): void => {
  const uuidToResponse = Object.fromEntries(
    response.values.filter(value => value.uuid !== undefined).map(value => [value.uuid, value]),
  )
  changes
    .map(getChangeData)
    .filter(instance => uuidToResponse[instance.value.uuid] !== undefined)
    .forEach(instance => listenersAuditSetter(instance, uuidToResponse[instance.value.uuid]))
}

// this function rebuilds the type inside the instance based on the instance's fields
const fixType = (
  change: Change<InstanceElement>,
  scriptRunnerApiDefinitions: JiraDuckTypeConfig,
): Change<InstanceElement> =>
  ({
    action: change.action,
    data: _.mapValues(change.data, (instance: InstanceElement) =>
      replaceInstanceTypeForDeploy({
        instance,
        config: scriptRunnerApiDefinitions,
      }),
    ),
  }) as Change<InstanceElement>

export const getValuesToDeploy = async ({
  changes,
  valuesFromService,
  identifier,
  scriptRunnerApiDefinitions,
}: {
  changes: Change[]
  valuesFromService: Value[]
  identifier: string
  scriptRunnerApiDefinitions: JiraDuckTypeConfig
}): Promise<{
  errors: SaltoElementError[]
  appliedChanges: Change[]
  valuesToDeploy: Value[]
}> => {
  const idToIndex = Object.fromEntries(valuesFromService.map((value, index) => [value[identifier], index]))
  const errors: SaltoElementError[] = []
  const appliedChanges: Change[] = []
  const valuesToDeploy = _.cloneDeep(valuesFromService)

  await awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .forEach(async change => {
      const typeFixedChange = fixType(change, scriptRunnerApiDefinitions)
      const resolvedChange = await resolveChangeElement(typeFixedChange, getLookUpName, resolveValues)
      const instance = getChangeData(resolvedChange)
      const index = idToIndex[instance.value[identifier]]
      if (index !== undefined) {
        log.error('Should never happened, newly created uuid exists in the service')
        const message = 'Instance already exists in the service'
        errors.push({
          message,
          detailedMessage: message,
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        })
      } else {
        valuesToDeploy.push(instance.value)
        appliedChanges.push(change)
      }
    })

  await awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .forEach(async change => {
      const resolvedChange = await resolveChangeElement(change, getLookUpName, resolveValues)
      const instance = getChangeData(resolvedChange)
      const index = idToIndex[instance.value[identifier]]
      if (index !== undefined) {
        valuesToDeploy[index] = instance.value
        appliedChanges.push(change)
      } else {
        const message = 'Instance does not exist in the service'
        errors.push({
          severity: 'Error',
          message,
          detailedMessage: message,
          elemID: instance.elemID,
        })
      }
    })

  await awu(changes)
    .filter(isRemovalChange)
    .filter(isInstanceChange)
    .forEach(async change => {
      const resolvedChange = await resolveChangeElement(change, getLookUpName, resolveValues)
      const instance = getChangeData(resolvedChange)
      // using find Index as the indices change when we remove elements
      const index = valuesToDeploy.findIndex(value => value[identifier] === instance.value[identifier])
      if (index !== -1) {
        valuesToDeploy.splice(index, 1)
        appliedChanges.push(change)
      } else {
        const message = 'Instance does not exist in the service'
        errors.push({
          severity: 'Error',
          message,
          detailedMessage: message,
          elemID: instance.elemID,
        })
      }
    })
  return { errors, appliedChanges, valuesToDeploy }
}

// This filter deploys script runner instances that are deployed in batches
const filter: FilterCreator = ({ scriptRunnerClient, config }) => ({
  name: 'scripRunnerBatchDeployFilter',
  deploy: async changes => {
    const { scriptRunnerApiDefinitions } = config
    if (!config.fetch.enableScriptRunnerAddon || scriptRunnerApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }

    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === SCRIPT_RUNNER_LISTENER_TYPE,
    )
    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: { errors: [], appliedChanges: [] },
      }
    }
    let valuesFromService: Value[]
    try {
      const response = await scriptRunnerClient.get({
        url: '/sr-dispatcher/jira/admin/token/scriptevents',
      })
      if (!isListenersResponse(response.data)) {
        throw new Error('Received an invalid script runner listeners response')
      }
      valuesFromService = response.data.values
    } catch {
      const message = 'Error getting other script-listeners information from the service'
      return {
        leftoverChanges,
        deployResult: {
          errors: relevantChanges.map(getChangeData).map(instance => ({
            severity: 'Error' as SeverityLevel,
            message,
            detailedMessage: message,
            elemID: instance.elemID,
          })),
          appliedChanges: [],
        },
      }
    }
    const { errors, appliedChanges, valuesToDeploy } = await getValuesToDeploy({
      changes: relevantChanges,
      valuesFromService,
      identifier: 'uuid',
      scriptRunnerApiDefinitions,
    })
    try {
      const response = await scriptRunnerClient.put({
        url: '/sr-dispatcher/jira/admin/token/scriptevents',
        data: valuesToDeploy,
      })
      if (isListenersResponse(response.data)) {
        updateAuditData(relevantChanges.filter(isInstanceChange), response.data)
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : e
      log.error(`Failed to put script runner listeners with the error: ${errorMessage}`)
      errors.push(
        ...appliedChanges.map(getChangeData).map(instance => ({
          severity: 'Error' as SeverityLevel,
          message: `${errorMessage}`,
          detailedMessage: `${errorMessage}`,
          elemID: instance.elemID,
        })),
      )
      return {
        deployResult: { appliedChanges: [], errors },
        leftoverChanges,
      }
    }
    return {
      deployResult: { appliedChanges, errors },
      leftoverChanges,
    }
  },
})

export default filter
