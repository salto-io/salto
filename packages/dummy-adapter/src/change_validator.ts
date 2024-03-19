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
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { GeneratorParams } from './generator'
import fromAdapterConfig from './change_validators/from_adapter_config'

const { createChangeValidator, createOutgoingUnresolvedReferencesValidator } = deployment.changeValidators

export const changeValidator = (config: GeneratorParams): ChangeValidator => {
  const validators: Record<string, ChangeValidator> = {
    dummy: fromAdapterConfig(config),
    outgoingUnresolvedReferences: createOutgoingUnresolvedReferencesValidator(),
  }

  return createChangeValidator({ validators })
}
