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
import { getChangeData, isAdditionOrModificationChange, Value } from '@salto-io/adapter-api'
import { CONFIGURATION_VALIDATOR_TYPE } from '../../change_validators/workflows/empty_validator_workflow'
import { FilterCreator } from '../../filter'
import { getWorkflowChanges, WorkflowInstance } from './types'

type TransitionValidator = {
    type: string
    configuration?: {
        [key: string]: string
    }
}

const removeValidatorsWithoutConfiguration = (instance: WorkflowInstance): void => {
  Object.values(instance.value.transitions)
    .filter((transition: Value) => transition.rules?.validators !== undefined)
    .forEach((transition: Value) => {
      transition.rules.validators = transition.rules.validators.filter(
        (validator: TransitionValidator) => 'configuration' in validator || !CONFIGURATION_VALIDATOR_TYPE.has(validator.type)
      )
    })
}

const filter: FilterCreator = () => ({
  name: 'emptyValidatorWorkflowFilter',
  preDeploy: async changes => {
    getWorkflowChanges(changes)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .forEach(removeValidatorsWithoutConfiguration)
  },
})

export default filter
