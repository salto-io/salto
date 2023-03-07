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

import { WalkOnFunc, walkOnValue, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { isInstanceElement, Element, isInstanceChange, isAdditionOrModificationChange, getChangeData, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { SCRIPT_RUNNER_DC_TYPES } from './workflow_dc'

const SCRIPT_RUNNER_OR = '|||'
export const OR_FIELDS = [
  'FIELD_TRANSITION_OPTIONS',
  'FIELD_SELECTED_FIELDS',
  'FIELD_LINK_DIRECTION',
  'FIELD_FIELD_IDS',
  'FIELD_REQUIRED_FIELDS',
  'FIELD_USER_IN_FIELDS',
  'FIELD_GROUP_NAMES',
  'FIELD_LINKED_ISSUE_RESOLUTION',
  'FIELD_PROJECT_ROLE_IDS',
  'FIELD_USER_IDS',
  'FIELD_LINKED_ISSUE_STATUS',
]

const returnOr: WalkOnFunc = ({ value }): WALK_NEXT_STEP => {
  if (typeof value === 'object' && value !== null) {
    Object.entries(value)
      .filter(([key]) => OR_FIELDS.includes(key))
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      .forEach(([key, val]) => {
        value[key] = val.join(SCRIPT_RUNNER_OR)
      })
  }
  return WALK_NEXT_STEP.RECURSE
}

const replaceOr: WalkOnFunc = ({ value }): WALK_NEXT_STEP => {
  if (_.isPlainObject(value)) {
    Object.entries(value)
      .filter(([key]) => OR_FIELDS.includes(key))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .forEach(([key, val]) => {
        value[key] = val.split(SCRIPT_RUNNER_OR)
      })
  }
  return WALK_NEXT_STEP.RECURSE
}

const findScriptRunnerDC = (func: Value): WalkOnFunc => (
  ({ value, path }): WALK_NEXT_STEP => {
    if (SCRIPT_RUNNER_DC_TYPES.includes(value.type) && value.configuration !== undefined) {
      walkOnValue({ elemId: path.createNestedID('configuration'),
        value: value.configuration,
        func })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  })

// Changes script runners strings that represent several values and are split by '|||' to an array
// for example:
// FIELD_TRANSITION_OPTIONS = "FIELD_SKIP_PERMISSIONS|||FIELD_SKIP_VALIDATORS|||FIELD_SKIP_CONDITIONS"
const filter: FilterCreator = ({ client, config }) => ({
  name: 'scriptRunnerWorkflowOrFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: findScriptRunnerDC(replaceOr) })
      })
  },
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: findScriptRunnerDC(returnOr) })
      })
  },
  onDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: findScriptRunnerDC(replaceOr) })
      })
  },
})

export default filter
