/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { AdapterAuthMethod, AdapterAuthentication, InstanceElement, ObjectType, OAuthMethod, ElemID } from '@salto-io/adapter-api'
import { EOL } from 'os'
import { addAdapter, getLoginStatuses, LoginStatus, updateCredentials, getAdaptersCredentialsTypes, installAdapter, getSupportedServiceAdapterNames } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { naclCase } from '@salto-io/adapter-utils'
import { getCredentialsFromUser } from '../callbacks'
import { CliOutput, CliExitCode, KeyedOption } from '../types'
import { createCommandGroupDef, WorkspaceCommandAction, createWorkspaceCommand } from '../command_builder'
import { formatAccountAlreadyAdded, formatAccountAdded, formatLoginToAccountFailed, formatCredentialsHeader, formatLoginUpdated, formatAccountNotConfigured, formatLoginOverride, formatConfiguredAndAdditionalAccounts, formatAddServiceFailed, formatInvalidServiceInput } from '../formatter'
import { errorOutputLine, outputLine } from '../outputer'
import { processOauthCredentials } from '../cli_oauth_authenticator'
import { EnvArg, ENVIRONMENT_OPTION, validateAndSetEnv } from './common/env'


type AuthTypeArgs = {
  authType: AdapterAuthMethod
}

const AUTH_TYPE_OPTION: KeyedOption<AuthTypeArgs> = {
  name: 'authType',
  alias: 'a',
  description: 'The type of authorization you would like to use for the account. Options = [basic, oauth]',
  type: 'string',
  required: false,
  choices: ['basic', 'oauth'],
  default: 'basic',
}

const getOauthConfig = async (
  oauthMethod: OAuthMethod,
  output: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<InstanceElement> => {
  outputLine(formatCredentialsHeader(oauthMethod.oauthRequestParameters.elemID.adapter), output)
  const newConfig = await getLoginInput(oauthMethod.oauthRequestParameters)
  const oauthParameters = oauthMethod.createOAuthRequest(newConfig)
  const credentials = oauthMethod.createFromOauthResponse(newConfig.value,
    await processOauthCredentials(newConfig.value.port,
      oauthParameters.oauthRequiredFields, oauthParameters.url, output))
  return new InstanceElement(ElemID.CONFIG_NAME, oauthMethod.credentialsType, credentials)
}

const getConfigFromInput = async (
  authType: AdapterAuthMethod,
  authMethods: AdapterAuthentication,
  output: CliOutput,
  getLoginInput: (configType: ObjectType) =>
    Promise<InstanceElement>): Promise<InstanceElement> => {
  let newConfig: InstanceElement
  if (authType === 'oauth' && authMethods.oauth) {
    newConfig = await getOauthConfig(authMethods.oauth, output, getLoginInput)
  } else {
    const configType = authMethods[authType]
    if (configType) {
      outputLine(formatCredentialsHeader(configType.credentialsType.elemID.adapter), output)
      newConfig = await getLoginInput(configType.credentialsType)
    } else {
      throw new Error(`Adapter does not support authentication of type ${authType}`)
    }
  }
  newConfig.value.authType = authType
  return newConfig
}

const getLoginInputFlow = async (
  workspace: Workspace,
  authMethods: AdapterAuthentication,
  output: CliOutput,
  authType: AdapterAuthMethod,
  account: string,
): Promise<void> => {
  const newConfig = await getConfigFromInput(authType, authMethods, output, getCredentialsFromUser)
  await updateCredentials(workspace, newConfig, account)
  output.stdout.write(EOL)
  outputLine(formatLoginUpdated, output)
}

// Add
type AccountAddArgs = {
    login: boolean
    serviceName: string
    account?: string
} & AuthTypeArgs & EnvArg

export const addAction: WorkspaceCommandAction<AccountAddArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { login, serviceName, authType, account } = input
  if (account !== undefined && !(naclCase(account) === account)) {
    errorOutputLine(`Invalid account name: ${account}, account name may only include letters, digits or underscores`, output)
    return CliExitCode.UserInputError
  }
  if (account !== undefined && (account === '')) {
    errorOutputLine('Account name may not be an empty string.', output)
    return CliExitCode.UserInputError
  }
  if (account !== undefined && account === 'var') {
    errorOutputLine('Account name may not be "var"', output)
    return CliExitCode.UserInputError
  }
  const accountName = account ?? serviceName
  await validateAndSetEnv(workspace, input, output)

  const supportedServiceAdapters = getSupportedServiceAdapterNames()
  if (!supportedServiceAdapters.includes(serviceName)) {
    errorOutputLine(formatInvalidServiceInput(serviceName, supportedServiceAdapters), output)
    return CliExitCode.UserInputError
  }

  if (workspace.accounts().includes(accountName)) {
    errorOutputLine(formatAccountAlreadyAdded(accountName), output)
    return CliExitCode.UserInputError
  }

  await installAdapter(serviceName)
  if (login) {
    const adapterCredentialsTypes = getAdaptersCredentialsTypes([serviceName])[serviceName]
    try {
      await getLoginInputFlow(workspace, adapterCredentialsTypes, output, authType, accountName)
    } catch (e) {
      errorOutputLine(formatAddServiceFailed(accountName, e.message), output)
      return CliExitCode.AppError
    }
  }

  await addAdapter(workspace, serviceName, accountName)
  await workspace.flush()
  outputLine(formatAccountAdded(serviceName), output)
  return CliExitCode.Success
}

const serviceAddDef = createWorkspaceCommand({
  properties: {
    name: 'add',
    description: 'Add an account on a service to the environment',
    keyedOptions: [
      {
        // Will be replaced with --no-login
        name: 'login',
        default: true,
        alias: 'n',
        type: 'boolean',
        description: 'Do not login to account when adding it. Example usage: \'service add <service-name> --no-login\'.',
        required: false,
      },
      {
        name: 'account',
        type: 'string',
        description: 'Account name for the service, in case multiple accounts are configured under the same environment.',
        required: false,
      },
      AUTH_TYPE_OPTION,
      ENVIRONMENT_OPTION,
    ],
    positionalOptions: [
      {
        name: 'serviceName',
        type: 'string',
        description: 'The name of the service',
        required: true,
      },
    ],
  },
  action: addAction,
})

// List
type ServiceListArgs = {} & EnvArg

export const listAction: WorkspaceCommandAction<ServiceListArgs> = async (
  { input, output, workspace },
): Promise<CliExitCode> => {
  await validateAndSetEnv(workspace, input, output)
  outputLine(formatConfiguredAndAdditionalAccounts(workspace.accounts()), output)
  return CliExitCode.Success
}

const accountListDef = createWorkspaceCommand({
  properties: {
    name: 'list',
    description: 'List all environment accounts',
    keyedOptions: [
      ENVIRONMENT_OPTION,
    ],
  },
  action: listAction,
})

// Login
type ServiceLoginArgs = {
    accountName: string
} & AuthTypeArgs & EnvArg

export const loginAction: WorkspaceCommandAction<ServiceLoginArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { accountName, authType } = input
  await validateAndSetEnv(workspace, input, output)
  if (!workspace.accounts().includes(accountName)) {
    errorOutputLine(formatAccountNotConfigured(accountName), output)
    return CliExitCode.AppError
  }
  const accountLoginStatus = (await getLoginStatuses(
    workspace,
    [accountName],
  ))[accountName] as LoginStatus
  if (accountLoginStatus.isLoggedIn) {
    outputLine(formatLoginOverride, output)
  }
  try {
    await getLoginInputFlow(workspace, accountLoginStatus.configTypeOptions,
      output, authType, accountName)
  } catch (e) {
    errorOutputLine(formatLoginToAccountFailed(accountName, e.message), output)
    return CliExitCode.AppError
  }
  return CliExitCode.Success
}

const accountLoginDef = createWorkspaceCommand({
  properties: {
    name: 'login',
    description: 'Set the account credentials',
    keyedOptions: [
      AUTH_TYPE_OPTION,
      ENVIRONMENT_OPTION,
    ],
    positionalOptions: [
      {
        name: 'accountName',
        type: 'string',
        description: 'The name of the account',
        required: true,
      },
    ],
  },
  action: loginAction,
})

const accountGroupDef = createCommandGroupDef({
  properties: {
    name: 'service',
    description: 'Manage the environment accounts',
  },
  subCommands: [
    serviceAddDef,
    accountListDef,
    accountLoginDef,
  ],
})

export default accountGroupDef
