/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

export const getAdaptersTags = (adapters: string[]): Tags =>
  Object.fromEntries(
    adapters
      .filter(adapter => getSupportedServiceAdapterNames().includes(adapter))
      .map(adapter => [`adapter-${adapter}`, true]),
  )

const getValidAccounts = (envAccounts: string[], inputAccounts?: string[]): string[] =>
  _.isEmpty(inputAccounts) ? [...envAccounts] : _.intersection(inputAccounts, envAccounts)

export const getTagsForAccounts = (args: { workspace: Workspace } & AccountsArg & EnvArg): Tags => {
  const { workspace, accounts, env } = args
  return getAdaptersTags(getValidAccounts(workspace.accounts(env), accounts).map(workspace.getServiceFromAccountName))
}

export const getAndValidateActiveAccounts = (workspace: Workspace, inputAccounts?: string[]): string[] => {
  const workspaceAccounts = workspace.accounts()
  if (workspaceAccounts.length === 0) {
    throw new Error(`No services are configured for env=${workspace.currentEnv()}. Use 'salto account add'.`)
  }

  const validAccounts = getValidAccounts(workspaceAccounts, inputAccounts)
  if (inputAccounts) {
    const diffAccounts = _.difference(inputAccounts, validAccounts)
    if (diffAccounts.length > 0) {
      const accountsErrorMessage = diffAccounts.length === 1 ? 'an account' : 'accounts'
      throw new Error(
        `Environment ${workspace.currentEnv()} does not have ${accountsErrorMessage} named ${diffAccounts.join(', ')}`,
      )
    }
  }

  return validAccounts
}
