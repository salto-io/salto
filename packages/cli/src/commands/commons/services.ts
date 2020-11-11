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
import _ from 'lodash'
import { Workspace } from '@salto-io/workspace'
import { KeyedOption } from '../../command_builder'

export type ServicesArg = {
    services?: string[]
}

export const SERVICES_OPTION: KeyedOption<ServicesArg> = {
  name: 'services',
  alias: 's',
  required: false,
  description: 'Specific services to perform this action for (default=all)',
  type: 'stringsList',
}

export const getAndValidateActiveServices = (
  workspace: Workspace,
  inputServices?: string[]
): string[] => {
  if (workspace.services().length === 0) {
    throw new Error(`No services are configured for env=${workspace.currentEnv()}. Use 'salto service add'.`)
  }
  if (inputServices === undefined) {
    return [...workspace.services()]
  }
  const diffServices = _.difference(inputServices, workspace.services() || [])
  if (diffServices.length > 0) {
    throw new Error(`Not all services (${diffServices}) are set up for this workspace`)
  }
  return inputServices
}
