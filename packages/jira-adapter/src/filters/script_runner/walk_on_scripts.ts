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

import { walkOnValue, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { InstanceElement, Value } from '@salto-io/adapter-api'
import { SCRIPT_RUNNER_DC_TYPES } from './workflow/workflow_dc'
import { SCRIPT_RUNNER_CLOUD_TYPES } from './workflow/workflow_cloud'
import { isWorkflowV1Instance } from '../workflow/types'
import { BEHAVIOR_TYPE, SCRIPT_RUNNER_TYPES } from '../../constants'

const WORKFLOW_SCRIPT_DC_FIELDS = ['FIELD_CONDITION', 'FIELD_ADDITIONAL_SCRIPT', 'FIELD_SCRIPT_FILE_OR_SCRIPT']
const WORKFLOW_SCRIPT_CLOUD_FIELDS = ['expression', 'additionalCode', 'emailCode', 'condition']
const SCRIPT_CLOUD_FIELDS = ['script', 'executionCondition', 'codeToRun']

export type referenceFunc = (value: Value, fieldName: string) => void

const isCloudScriptRunnerItem = (value: Value): boolean =>
  SCRIPT_RUNNER_CLOUD_TYPES.includes(value.type) && value.configuration?.scriptRunner != null

const walkOnCloudScripts =
  (func: (value: string, fieldName: string) => void): WalkOnFunc =>
  ({ value }): WALK_NEXT_STEP => {
    if (value == null) {
      return WALK_NEXT_STEP.SKIP
    }
    if (isCloudScriptRunnerItem(value)) {
      WORKFLOW_SCRIPT_CLOUD_FIELDS.forEach(fieldName => {
        if (value.configuration.scriptRunner[fieldName] != null) {
          func(value.configuration.scriptRunner, fieldName)
        }
      })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }

const isDCScriptRunnerItem = (value: Value): boolean =>
  SCRIPT_RUNNER_DC_TYPES.includes(value.type) && value.configuration != null

const walkOnDcScripts =
  (func: referenceFunc): WalkOnFunc =>
  ({ value }): WALK_NEXT_STEP => {
    if (value == null) {
      return WALK_NEXT_STEP.SKIP
    }
    if (isDCScriptRunnerItem(value)) {
      WORKFLOW_SCRIPT_DC_FIELDS.forEach(fieldName => {
        if (value.configuration[fieldName]?.script != null) {
          func(value.configuration[fieldName], 'script')
        }
      })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }

export const walkOnScripts = ({
  func,
  isDc,
  instances,
}: {
  func: referenceFunc
  isDc: boolean
  instances: InstanceElement[]
}): void => {
  instances.filter(isWorkflowV1Instance).forEach(instance => {
    Object.entries(instance.value.transitions).forEach(([key, transition]) => {
      if (transition.rules !== undefined) {
        walkOnValue({
          elemId: instance.elemID.createNestedID('transitions', key, 'rules'),
          value: transition.rules,
          func: isDc ? walkOnDcScripts(func) : walkOnCloudScripts(func),
        })
      }
    })
  })
  instances
    .filter(instance => SCRIPT_RUNNER_TYPES.includes(instance.elemID.typeName))
    .forEach(instance => {
      Object.keys(instance.value)
        .filter(key => SCRIPT_CLOUD_FIELDS.includes(key))
        .forEach(key => func(instance.value, key))
    })

  instances
    .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
    .forEach(instance => {
      instance.value.config?.forEach((config: Value) => {
        func(config, 'typescript')
        func(config, 'javascript')
      })
    })
}
