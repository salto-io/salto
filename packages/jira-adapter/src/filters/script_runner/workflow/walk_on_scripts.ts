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

import { walkOnValue, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { InstanceElement, Value } from '@salto-io/adapter-api'
import { SCRIPT_RUNNER_DC_TYPES } from './workflow_dc'
import { SCRIPT_RUNNER_CLOUD_TYPES } from './workflow_cloud'
import { Transition, isWorkflowInstance } from '../../workflow/types'


const SCRIPT_DC_FIELDS = ['FIELD_CONDITION', 'FIELD_ADDITIONAL_SCRIPT', 'FIELD_SCRIPT_FILE_OR_SCRIPT']
const SCRIPT_CLOUD_FIELDS = ['expression', 'additionalCode', 'emailCode', 'condition']

export type referenceFunc = (value: Value, fieldName: string) => void

const isCloudScriptRunnerItem = (value: Value): boolean =>
  SCRIPT_RUNNER_CLOUD_TYPES.includes(value.type) && value.configuration?.scriptRunner != null

const walkOnCloudScripts = (func: (value: string, fieldName: string) => void)
  : WalkOnFunc => ({ value }): WALK_NEXT_STEP => {
  if (value == null) {
    return WALK_NEXT_STEP.SKIP
  }
  if (isCloudScriptRunnerItem(value)) {
    SCRIPT_CLOUD_FIELDS.forEach(fieldName => {
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

const walkOnDcScripts = (func: referenceFunc)
  : WalkOnFunc => ({ value }): WALK_NEXT_STEP => {
  if (value == null) {
    return WALK_NEXT_STEP.SKIP
  }
  if (isDCScriptRunnerItem(value)) {
    SCRIPT_DC_FIELDS.forEach(fieldName => {
      if (value.configuration[fieldName]?.script != null) {
        func(value.configuration[fieldName], 'script')
      }
    })
    return WALK_NEXT_STEP.SKIP
  }
  return WALK_NEXT_STEP.RECURSE
}

export const walkOnScripts = (
  { func, isDc, instances }
  : { func: referenceFunc; isDc: boolean; instances: InstanceElement[]}
): void => {
  instances
    .filter(isWorkflowInstance)
    .forEach(instance => {
      instance.value.transitions.forEach((transition: Transition, index: number) => {
        if (transition.rules !== undefined) {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions', index.toString(), 'rules'),
            value: transition.rules,
            func: isDc
              ? walkOnDcScripts(func)
              : walkOnCloudScripts(func) })
        }
      })
    })
}
