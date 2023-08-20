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

import { invertNaclCase, naclCase } from '@salto-io/adapter-utils'
import { SaltoError, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { Status, Transition, WorkflowInstance } from './types'
import { SCRIPT_RUNNER_POST_FUNCTION_TYPE } from '../script_runner/workflow/workflow_cloud'

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

const getTransitionType = (transition: Transition): TransitionType => {
  if (transition.type === 'initial') {
    return 'Initial'
  }
  if (transition.from !== undefined
    && transition.from.length !== 0) {
    return 'Directed'
  }
  if ((transition.to ?? '') === '') {
    return 'Circular'
  }
  return 'Global'
}

// returns a map of with the expected transition IDs after deployment for each transition key
export const transitionKeysToExpectedIds = (workflowInstance: WorkflowInstance): Map<string, string> => {
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

export const createStatusMap = (statuses: Status[]): Map<string, string> => new Map(statuses
  .filter((status): status is {id: string; name: string} => typeof status.id === 'string' && status.name !== undefined)
  .map((status => [status.id, status.name])))

export const getTransitionKey = (transition: Transition, statusesMap: Map<string, string>): string => {
  const type = getTransitionType(transition)
  const fromSorted = type === 'Directed'
    ? (transition.from?.map(from => (
      typeof from === 'string' ? from : from.id ?? ''
    )) ?? [])
      .map(from => statusesMap.get(from) ?? from)
      .sort()
      .join(',')
    : TYPE_TO_FROM_MAP[type]

  return naclCase([transition.name, `From: ${fromSorted}`, type].join(TRANSITION_PARTS_SEPARATOR))
}

export const transformTransitions = (value: Value): SaltoError[] => {
  const statusesMap = createStatusMap(value.statuses ?? [])
  const maxCounts = _(value.transitions).map(transition => getTransitionKey(transition, statusesMap)).countBy().value()

  const counts: Record<string, number> = {}

  value.transitions = Object.fromEntries(value.transitions
    // This is Value and not the actual type as we change types
    .map((transition: Value) => {
      const key = getTransitionKey(transition, statusesMap)
      counts[key] = (counts[key] ?? 0) + 1
      if (maxCounts[key] > 1) {
        return [naclCase(`${invertNaclCase(key)}${TRANSITION_PARTS_SEPARATOR}${counts[key]}`), transition]
      }
      return [key, transition]
    }))
  const errorKeyNames = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key]) => invertNaclCase(key).split(TRANSITION_PARTS_SEPARATOR)[0])

  return errorKeyNames.length === 0
    ? []
    : [{
      message: `The following transitions of workflow ${value.name} are not unique: ${errorKeyNames.join(', ')}.
It is strongly recommended to rename these transitions so they are unique in Jira, then re-fetch`,
      severity: 'Warning',
    }]
}

export const walkOverTransitionIds = (transition: Transition, func: (value: Value) => void): void => {
  transition.rules?.postFunctions
    ?.filter(postFunction => postFunction.type === SCRIPT_RUNNER_POST_FUNCTION_TYPE)
    .forEach(postFunction => {
      if (postFunction.configuration?.scriptRunner?.transitionId === undefined) {
        return
      }
      func(postFunction.configuration.scriptRunner)
    })
}

export const expectedToActualTransitionIds = ({ transitions, expectedTransitionIds, statusesMap }
: { transitions: Transition[]
  expectedTransitionIds: Map<string, string>
  statusesMap: Map<string, string>
}): Record<string, string> =>
  Object.fromEntries(transitions
    // create a map of [expectedId, actualId]
    .map(transition => [
      expectedTransitionIds.get(getTransitionKey(transition, statusesMap)),
      transition.id] as [string | undefined, string | undefined])
    .filter(([expectedId, actualId]) => expectedId !== undefined && actualId !== undefined)
    .filter(([expectedId, actualId]) => expectedId !== actualId))
