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
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { createUnresolvedReferencesValidator } from './unresolved_references'


export const DEFAULT_CHANGE_VALIDATORS = {
  unresolvedReferencesValidator: createUnresolvedReferencesValidator(),
}

type ValidatorName = keyof typeof DEFAULT_CHANGE_VALIDATORS

export const getDefaultChangeValidators = (
  validatorsToOmit: Array<ValidatorName> = []
): ChangeValidator[] => _(DEFAULT_CHANGE_VALIDATORS)
  .pickBy((_val, key) => !validatorsToOmit.includes(key as ValidatorName))
  .values()
  .filter(values.isDefined)
  .value()
