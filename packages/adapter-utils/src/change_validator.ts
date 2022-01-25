/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ChangeValidator } from '@salto-io/adapter-api'

const log = logger(module)

export const createChangeValidator = (
  changeValidators: ReadonlyArray<ChangeValidator>,
  disabledValidators?: ReadonlyArray<ChangeValidator>,
): ChangeValidator => async (changes, adapterConfig) => {
  if (disabledValidators !== undefined) {
    const disabledErrors = _.flatten(await Promise.all(
      disabledValidators.map(validator => validator(changes, adapterConfig))
    ))
    disabledErrors.forEach(error => {
      log.info(
        'Ignoring error from disabled validator on %s: %s %s',
        error.elemID.getFullName(), error.severity, error.detailedMessage,
      )
    })
  }
  return _.flatten(await Promise.all(
    changeValidators.map(validator => validator(changes, adapterConfig))
  ))
}
