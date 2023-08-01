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
import { ChangeValidator } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'

const log = logger(module)

export type ValidatorsActivationConfig = Record<string, boolean>
export const createChangeValidator = ({
  validators,
  validatorsActivationConfig = {},
}: {
  validators: Record<string, ChangeValidator>
  validatorsActivationConfig?: ValidatorsActivationConfig
}): ChangeValidator => async (changes, elementSource) => {
  const disabledValidatorNames = new Set<string>(
    Object.entries(validatorsActivationConfig).filter(([, enabled]) => !enabled).map(([name]) => name)
  )

  const activeValidators = Object.entries(validators).filter(([name]) => !disabledValidatorNames.has(name))

  if (disabledValidatorNames.size > 0) {
    log.info(`Running change validators with the following disabled: ${Array.from(disabledValidatorNames.keys()).join(', ')}`)
  }

  return _.flatten(await Promise.all(
    activeValidators.map(([name, validator]) => log.time(() => validator(changes, elementSource), `validator ${name}`))
  ))
}
