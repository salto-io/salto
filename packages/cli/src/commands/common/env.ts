/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { KeyedOption } from '../../command_builder'

export type EnvArg = {
    env?: string
}

export const ENVIORMENT_OPTION: KeyedOption<EnvArg> = {
  name: 'env',
  alias: 'e',
  required: false,
  description: 'The name of the environment to use (default=current env)',
  type: 'string',
}
