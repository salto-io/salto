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
import { Workspace } from '@salto-io/workspace'
import { Tags, getSupportedServiceAdapterNames } from '@salto-io/core'
import { KeyedOption } from '../../types'
import { EnvArg } from './env'

export type AccountsArg = {
    accounts?: string[]
}

export const ACCOUNTS_OPTION: KeyedOption<AccountsArg> = {
  name: 'accounts',
  alias: 's',
  required: false,
  description: 'Specific accounts to perform this action for (default=all)',
  type: 'stringsList',
}

export const getAdaptersTags = (adapters: string[]): Partial<Tags> => (
  Object.fromEntries(adapters
    .filter(adapter => getSupportedServiceAdapterNames().includes(adapter))
    .map(adapter => [`adapter-${adapter}`, true]))
)

export const getTagsForAccounts = (
  args: { workspace: Workspace } & AccountsArg & EnvArg
): Partial<Tags> => {
  const { workspace, accounts, env } = args
  const envAccounts = workspace.accounts(env)
  const validAccounts = _.isEmpty(accounts) ? envAccounts : _.intersection(accounts, envAccounts)
  return getAdaptersTags(validAccounts.map(workspace.getServiceFromAccountName))
}

export const getAndValidateActiveAccounts = (
  workspace: Workspace,
  inputAccounts?: string[]
): string[] => {
  const workspaceAccounts = workspace.accounts()
  if (workspaceAccounts.length === 0) {
    throw new Error(`No services are configured for env=${workspace.currentEnv()}. Use 'salto service add'.`)
  }
  if (inputAccounts === undefined) {
    return [...workspaceAccounts]
  }
  const diffAccounts = _.difference(inputAccounts, workspaceAccounts)
  if (diffAccounts.length > 0) {
    throw new Error(`Not all accounts (${diffAccounts}) are set up for this workspace`)
  }
  return inputAccounts
}
