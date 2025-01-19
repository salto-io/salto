/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ERROR_MESSAGES, invertNaclCase, naclCase } from '@salto-io/adapter-utils'
import { ReferenceExpression, SaltoError, Value } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isWorkflowV1Transition, Status, Transition as WorkflowTransitionV1, WorkflowV1Instance } from './types'
import { SCRIPT_RUNNER_POST_FUNCTION_TYPE } from '../script_runner/workflow/workflow_cloud'
import { isWorkflowV2Transition, WorkflowV2Transition, WorkflowVersionType } from '../workflowV2/types'

const { makeArray } = collections.array

export const TRANSITION_PARTS_SEPARATOR = '::'

type TransitionType = 'Directed' | 'Initial' | 'Global' | 'Circular'

const TYPE_TO_FROM_MAP: Record<Exclude<TransitionType, 'Directed'>, string> = {
  Initial: 'none',
  Global: 'any status',
  Circular: 'any status',
}

const getTransitionTypeFromKey = (key: string): string => {
  const type = invertNaclCase(key).split(TRANSITION_PARTS_SEPARATOR).pop() as string
  return type === 'Circular' ? 'Global' : type
}

const getTransitionType = (
  transition: WorkflowTransitionV1 | WorkflowV2Transition,
  workflowVersion: WorkflowVersionType,
): TransitionType => {
  if (transition.type?.toLowerCase() === 'initial') {
    return 'Initial'
  }
  if (workflowVersion === WorkflowVersionType.V2 && isWorkflowV2Transition(transition)) {
    if (transition.links !== undefined && transition.links.length !== 0) {
      return 'Directed'
    }
    if (transition.toStatusReference === undefined) {
      return 'Circular'
    }
  }
  if (workflowVersion === WorkflowVersionType.V1 && isWorkflowV1Transition(transition)) {
    if (transition.from !== undefined && transition.from.length !== 0) {
      return 'Directed'
    }
    if ((transition.to ?? '') === '') {
      return 'Circular'
    }
  }
  return 'Global'
}

// returns a map of with the expected transition IDs after deployment for each transition key
export const transitionKeysToExpectedIds = (workflowInstance: WorkflowV1Instance): Map<string, string> => {
  const groupedKeys = _.groupBy(Object.keys(workflowInstance.value.transitions), getTransitionTypeFromKey)

  const map = new Map<string, string>()

  groupedKeys.Initial?.forEach(key => map.set(key, '1'))
  let count = 0
  groupedKeys.Global?.forEach(key => {
    count += 1
    map.set(key, (1 + count * 10).toString())
  })
  groupedKeys.Directed?.forEach(key => {
    count += 1
    map.set(key, (1 + count * 10).toString())
  })

  return map
}

export const createStatusMap = (statuses: Status[]): Map<string, string> =>
  new Map(
    statuses
      .filter(
        (status): status is { id: string; name: string } => typeof status.id === 'string' && status.name !== undefined,
      )
      .map(status => [status.id, status.name]),
  )

export const getTransitionKey = ({
  transition,
  statusesMap,
  workflowVersion,
}: {
  transition: WorkflowTransitionV1 | WorkflowV2Transition
  statusesMap: Map<string, string>
  workflowVersion: WorkflowVersionType
}): string => {
  const type = getTransitionType(transition, workflowVersion)
  let fromIds: (string | ReferenceExpression | undefined)[] = []
  if (workflowVersion === WorkflowVersionType.V2 && isWorkflowV2Transition(transition)) {
    fromIds = makeArray(transition.links).map(link => link.fromStatusReference)
  }
  if (workflowVersion === WorkflowVersionType.V1 && isWorkflowV1Transition(transition)) {
    fromIds = makeArray(transition.from).map(from => (_.isString(from) ? from : from.id ?? ''))
  }
  const fromSorted =
    type === 'Directed'
      ? fromIds
          .map(from => (_.isString(from) && statusesMap.get(from) !== undefined ? statusesMap.get(from) : from))
          .sort()
          .join(',')
      : TYPE_TO_FROM_MAP[type]

  return naclCase([transition.name, `From: ${fromSorted}`, type].join(TRANSITION_PARTS_SEPARATOR))
}

export const transformTransitions = ({
  value,
  workflowVersion,
  statuses,
}: {
  value: Value
  workflowVersion: WorkflowVersionType
  statuses?: Pick<Status, 'id' | 'name'>[]
}): SaltoError[] => {
  const statusesMap = createStatusMap(statuses ?? value.statuses ?? [])
  const maxCounts = _(value.transitions)
    .map(transition => getTransitionKey({ transition, statusesMap, workflowVersion }))
    .countBy()
    .value()

  const counts: Record<string, number> = {}

  value.transitions = Object.fromEntries(
    value.transitions
      // This is Value and not the actual type as we change types
      .map((transition: Value) => {
        const key = getTransitionKey({ transition, statusesMap, workflowVersion })
        counts[key] = (counts[key] ?? 0) + 1
        if (maxCounts[key] > 1) {
          return [naclCase(`${invertNaclCase(key)}${TRANSITION_PARTS_SEPARATOR}${counts[key]}`), transition]
        }
        return [key, transition]
      }),
  )
  const errorKeyNames = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key]) => invertNaclCase(key).split(TRANSITION_PARTS_SEPARATOR)[0])

  const message = `The following transitions of workflow ${value.name} are not unique: ${errorKeyNames.join(', ')}.
It is strongly recommended to rename these transitions so they are unique in Jira, then re-fetch`
  return errorKeyNames.length === 0
    ? []
    : [
        {
          message: ERROR_MESSAGES.OTHER_ISSUES,
          detailedMessage: message,
          severity: 'Warning',
        },
      ]
}

export const walkOverTransitionIds = (transition: WorkflowTransitionV1, func: (value: Value) => void): void => {
  transition.rules?.postFunctions
    ?.filter(postFunction => postFunction.type === SCRIPT_RUNNER_POST_FUNCTION_TYPE)
    .forEach(postFunction => {
      if (
        postFunction.configuration?.scriptRunner?.transitionId !== undefined &&
        !_.isEmpty(postFunction.configuration.scriptRunner.transitionId)
      ) {
        func(postFunction.configuration.scriptRunner)
      }
    })
}

export const walkOverTransitionIdsV2 = (transition: WorkflowV2Transition, func: (value: Value) => void): void => {
  transition.actions
    ?.filter(
      action =>
        action.parameters?.appKey === SCRIPT_RUNNER_POST_FUNCTION_TYPE &&
        !_.isEmpty(_.get(action, 'parameters.scriptRunner.transitionId')),
    )
    .forEach(action => {
      func(action.parameters?.scriptRunner)
    })
}

export const expectedToActualTransitionIds = ({
  transitions,
  expectedTransitionIds,
  statusesMap,
  workflowVersion,
}: {
  transitions: WorkflowTransitionV1[]
  expectedTransitionIds: Map<string, string>
  statusesMap: Map<string, string>
  workflowVersion: WorkflowVersionType
}): Record<string, string> =>
  Object.fromEntries(
    transitions
      // create a map of [expectedId, actualId]
      .map(
        transition =>
          [
            expectedTransitionIds.get(getTransitionKey({ transition, statusesMap, workflowVersion })),
            transition.id,
          ] as [string | undefined, string | undefined],
      )
      .filter(([expectedId, actualId]) => expectedId !== undefined && actualId !== undefined)
      .filter(([expectedId, actualId]) => expectedId !== actualId),
  )
