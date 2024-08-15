/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  isInstanceElement,
  Element,
  isAdditionOrModificationChange,
  getChangeData,
  isInstanceChange,
  Value,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../../filter'
import { WorkflowV1Instance, isWorkflowV1Instance } from '../../workflow/types'
import { SCRIPT_RUNNER_POST_FUNCTION_TYPE, SCRIPT_RUNNER_SEND_NOTIFICATIONS } from './workflow_cloud'

const { makeArray } = collections.array

const changeAccountIds = (workflowInstance: WorkflowV1Instance, func: (scriptRunner: Value) => Value): void => {
  Object.values(workflowInstance.value.transitions).forEach(transition => {
    makeArray(transition.rules?.postFunctions).forEach(postFunction => {
      if (
        postFunction.type === SCRIPT_RUNNER_POST_FUNCTION_TYPE &&
        postFunction.configuration?.scriptRunner?.className === SCRIPT_RUNNER_SEND_NOTIFICATIONS
      ) {
        postFunction.configuration.scriptRunner = func(postFunction.configuration.scriptRunner)
      }
    })
  })
}

const deleteEmptyAccountsId = (scriptRunner: Value): Value => {
  if (
    Array.isArray(scriptRunner.accountIds) &&
    scriptRunner.accountIds.length === 1 &&
    scriptRunner.accountIds[0] === ''
  ) {
    delete scriptRunner.accountIds
  }
  return scriptRunner
}

const addEmptyAccountsId = (scriptRunner: Value): Value => {
  if (scriptRunner.accountIds === undefined) {
    scriptRunner.accountIds = ['']
  }
  return scriptRunner
}

// Removes and returns the account ids for scriptRunner workflow instance, with post function of send notifications
// It prevents change validator errors on deployment
const filter: FilterCreator = ({ client, config }) => ({
  name: 'emptyAccountIdsFilter',
  onFetch: async (elements: Element[]) => {
    if (client.isDataCenter || !config.fetch.enableScriptRunnerAddon) {
      return
    }

    elements
      .filter(isInstanceElement)
      .filter(isWorkflowV1Instance)
      .forEach(workflowInstance => changeAccountIds(workflowInstance, deleteEmptyAccountsId))
  },
  preDeploy: async changes => {
    if (client.isDataCenter || !config.fetch.enableScriptRunnerAddon) {
      return
    }

    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(isWorkflowV1Instance)
      .forEach(workflowInstance => changeAccountIds(workflowInstance, addEmptyAccountsId))
  },
  onDeploy: async changes => {
    if (client.isDataCenter || !config.fetch.enableScriptRunnerAddon) {
      return
    }

    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(isWorkflowV1Instance)
      .forEach(workflowInstance => changeAccountIds(workflowInstance, deleteEmptyAccountsId))
  },
})
export default filter
