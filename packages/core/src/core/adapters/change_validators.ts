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
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { AdapterOperations, ChangeValidator } from '@salto-io/adapter-api'

export const getAdapterChangeValidators = (
  adapters: Record<string, AdapterOperations>,
  checkOnly: boolean,
): Record<string, ChangeValidator> =>
  _(adapters)
    .mapValues(adapter =>
      checkOnly ? adapter.validationModifiers?.changeValidator : adapter.deployModifiers?.changeValidator,
    )
    .pickBy(values.isDefined)
    .value()
