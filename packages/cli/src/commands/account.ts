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
import {
  AdapterAuthentication,
  AdapterAuthMethod,
  ElemID,
  InstanceElement,
  OAuthMethod,
  ObjectType,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { EOL } from 'os'
import {
  addAdapter,
  getAdaptersCredentialsTypes,
  getLoginStatuses,
  getSupportedServiceAdapterNames,
  installAdapter,
  LoginStatus,
  verifyCredentials,
  updateCredentials,
} from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { naclCase } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getConfigWithHeader } from '../callbacks'
import { CliExitCode, CliOutput, KeyedOption } from '../types'
import {
  createCommandGroupDef,
  createWorkspaceCommand,
  WorkspaceCommandAction,
  WorkspaceCommandArgs,
  WorkspaceCommandDef,
} from '../command_builder'
import {
  formatAccountAdded,
  formatAccountAlreadyAdded,
  formatAccountNotConfigured,
  formatAddServiceFailed,
  formatConfiguredAndAdditionalAccounts,
  formatCredentialsHeader,
  formatInvalidServiceInput,
  formatLoginOverride,
  formatLoginToAccountFailed,
  formatLoginUpdated,
} from '../formatter'
import { errorOutputLine, outputLine } from '../outputer'
import { processOauthCredentials } from '../cli_oauth_authenticator'
import { EnvArg, ENVIRONMENT_OPTION, validateAndSetEnv } from './common/env'
import { convertValueType } from './common/config_override'
import { getAdaptersTags, getTagsForAccounts } from './common/accounts'

const { isDefined } = values

const wrapWithDeprecationWarning =
  <T>(func: WorkspaceCommandAction<T>): WorkspaceCommandAction<T> =>
  async (args: WorkspaceCommandArgs<T>): Promise<CliExitCode> => {
    errorOutputLine("The 'service' command is deprecated. Use 'account' instead.", args.output)
    return func(args)
  }

const deprecatedCommandDef = <T>(def: WorkspaceCommandDef<T>): WorkspaceCommandDef<T> => ({
  ...def,
  action: wrapWithDeprecationWarning(def.action),
})

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

type LoginParametersArg = {
  loginParameters?: string[]
}

const LOGIN_PARAMETER_OPTION: KeyedOption<LoginParametersArg> = {
  name: 'loginParameters',
  alias: 'p',
  required: false,
  description:
    'Service login parameter in form of NAME=VALUE. Use in order to run this command in non interactive mode',
  type: 'stringsList',
}

const entryFromRawLoginParameter = (rawLoginParameter: string): string[] => {
  const match = rawLoginParameter.match(/^(\w+?)=(.+)$/)
  if (match === null) {
    throw new Error(`Parameter: "${rawLoginParameter}" is in a wrong format. Expected format is parameter=value`)
  }
  const [key, value] = match.slice(1)
  return [key, convertValueType(value)]
}

const getOauthConfig = async (
  oauthMethod: OAuthMethod,
  output: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<InstanceElement> => {
  outputLine(formatCredentialsHeader(oauthMethod.oauthRequestParameters.elemID.adapter), output)
  const newConfig = await getLoginInput(oauthMethod.oauthRequestParameters)
  const oauthParameters = oauthMethod.createOAuthRequest(newConfig)
  const credentials = await Promise.resolve(
    oauthMethod.createFromOauthResponse(
      newConfig.value,
      await processOauthCredentials(
        newConfig.value.port,
        oauthParameters.oauthRequiredFields,
        oauthParameters.url,
        output,
      ),
    ),
  )
  return new InstanceElement(ElemID.CONFIG_NAME, oauthMethod.credentialsType, credentials)
}

const getLoginConfig = async (
  authType: AdapterAuthMethod,
  authMethods: AdapterAuthentication,
  output: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<InstanceElement> => {
  let newConfig: InstanceElement
  if (authType === 'oauth' && authMethods.oauth) {
    newConfig = await getOauthConfig(authMethods.oauth, output, getLoginInput)
  } else {
    const configType = authMethods[authType]
    if (configType) {
      newConfig = await getLoginInput(configType.credentialsType)
    } else {
      throw new Error(`Adapter does not support authentication of type ${authType}`)
    }
  }
  newConfig.value.authType = authType
  return newConfig
}

const createConfigFromLoginParameters =
  (loginParameters: string[]) =>
  async (credentialsType: ObjectType): Promise<InstanceElement> => {
    const configValues = Object.fromEntries(loginParameters.map(entryFromRawLoginParameter))
    const requiredFields = Object.entries(credentialsType.fields)
      .filter(([_fieldName, field]) => field.annotations[CORE_ANNOTATIONS.REQUIRED] !== false)
      .map(([fieldName]) => fieldName)
    const missingLoginParameters = requiredFields.filter(key => _.isUndefined(configValues[key]))
    if (!_.isEmpty(missingLoginParameters)) {
      throw new Error(`Missing the following login parameters: ${missingLoginParameters}`)
    }
    return new InstanceElement(ElemID.CONFIG_NAME, credentialsType, configValues)
  }

const getLoginInputFlow = async (
  workspace: Workspace,
  authMethods: AdapterAuthentication,
  output: CliOutput,
  authType: AdapterAuthMethod,
  account: string,
  loginParameters?: string[],
): Promise<void> => {
  const getLoginInput = isDefined(loginParameters)
    ? createConfigFromLoginParameters(loginParameters)
    : // In this login option we ask the user to enter his credentials
      (credentialsType: ObjectType): Promise<InstanceElement> => getConfigWithHeader(credentialsType, output)
  const newConfig = await getLoginConfig(authType, authMethods, output, getLoginInput)
  const result = await verifyCredentials(newConfig)
  if (!result.success) {
    throw result.error
  }
  await updateCredentials(workspace, newConfig, account)
  output.stdout.write(EOL)
  outputLine(formatLoginUpdated, output)
}

// Add
type AccountAddArgs = {
  login: boolean
  serviceType: string
  accountName?: string
} & AuthTypeArgs &
  EnvArg &
  LoginParametersArg

const MAX_ACCOUNT_NAME_LENGTH = 100
export const addAction: WorkspaceCommandAction<AccountAddArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { login, serviceType, authType, accountName, loginParameters } = input
  if (accountName !== undefined) {
    if (naclCase(accountName) !== accountName) {
      errorOutputLine(
        `Invalid account name: ${accountName}, account name may only include letters, digits or underscores`,
        output,
      )
      return CliExitCode.UserInputError
    }
    if (accountName === '') {
      errorOutputLine('Account name may not be an empty string.', output)
      return CliExitCode.UserInputError
    }
    if (accountName === 'var') {
      errorOutputLine('Account name may not be "var"', output)
      return CliExitCode.UserInputError
    }
    if (accountName.length > MAX_ACCOUNT_NAME_LENGTH) {
      errorOutputLine(`Account name too long (maximum ${MAX_ACCOUNT_NAME_LENGTH})`, output)
      return CliExitCode.UserInputError
    }
  }
  const theAccountName = accountName ?? serviceType
  await validateAndSetEnv(workspace, input, output)

  const supportedServiceAdapters = getSupportedServiceAdapterNames()
  if (!supportedServiceAdapters.includes(serviceType)) {
    errorOutputLine(formatInvalidServiceInput(serviceType, supportedServiceAdapters), output)
    return CliExitCode.UserInputError
  }

  if (workspace.accounts().includes(theAccountName)) {
    errorOutputLine(formatAccountAlreadyAdded(theAccountName), output)
    return CliExitCode.UserInputError
  }

  await installAdapter(serviceType)
  if (login) {
    const adapterCredentialsTypes = getAdaptersCredentialsTypes([serviceType])[serviceType]
    try {
      await getLoginInputFlow(workspace, adapterCredentialsTypes, output, authType, theAccountName, loginParameters)
    } catch (e) {
      errorOutputLine(formatAddServiceFailed(serviceType, e.message), output)
      return CliExitCode.AppError
    }
  }

  await addAdapter(workspace, serviceType, theAccountName)
  await workspace.flush()
  outputLine(formatAccountAdded(serviceType), output)
  return CliExitCode.Success
}

const accountAddCommandDef: WorkspaceCommandDef<AccountAddArgs> = {
  properties: {
    name: 'add',
    description:
      'Add an application account to an environment.\n\nUse the --login-parameters option for non interactive execution.\n\nFor more information about supported login parameters please visit:\nhttps://github.com/salto-io/salto/blob/main/packages/cli/user_guide.md#non-interactive-execution',
    keyedOptions: [
      {
        // Will be replaced with --no-login
        name: 'login',
        default: true,
        alias: 'n',
        type: 'boolean',
        description: "Do not login to account when adding it. Example usage: 'add <service-name> --no-login'.",
        required: false,
      },
      {
        name: 'accountName',
        type: 'string',
        description:
          'Application account name. Use in case more than one account of a certain service type is added to the same environment.',
        required: false,
      },
      AUTH_TYPE_OPTION,
      ENVIRONMENT_OPTION,
      LOGIN_PARAMETER_OPTION,
    ],
    positionalOptions: [
      {
        name: 'serviceType',
        type: 'string',
        description: 'The type of the service',
        required: true,
      },
    ],
  },
  action: addAction,
  extraTelemetryTags: ({ input }) => getAdaptersTags([input.serviceType]),
}

export const accountAddDef = createWorkspaceCommand(accountAddCommandDef)
const serviceAddDef = createWorkspaceCommand(deprecatedCommandDef(accountAddCommandDef))

// List
type AccountListArgs = {} & EnvArg

export const listAction: WorkspaceCommandAction<AccountListArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  await validateAndSetEnv(workspace, input, output)
  outputLine(formatConfiguredAndAdditionalAccounts(workspace.accounts()), output)
  return CliExitCode.Success
}

const accountListCommandDef: WorkspaceCommandDef<AccountListArgs> = {
  properties: {
    name: 'list',
    description: 'List all environment application accounts',
    keyedOptions: [ENVIRONMENT_OPTION],
  },
  action: listAction,
}

const accountListDef = createWorkspaceCommand(accountListCommandDef)
const serviceListDef = createWorkspaceCommand(deprecatedCommandDef(accountListCommandDef))

// Login
type AccountLoginArgs = {
  accountName: string
} & AuthTypeArgs &
  EnvArg &
  LoginParametersArg

export const loginAction: WorkspaceCommandAction<AccountLoginArgs> = async ({
  input,
  output,
  workspace,
}): Promise<CliExitCode> => {
  const { accountName, authType, loginParameters } = input
  await validateAndSetEnv(workspace, input, output)
  if (!workspace.accounts().includes(accountName)) {
    errorOutputLine(formatAccountNotConfigured(accountName), output)
    return CliExitCode.AppError
  }
  const accountLoginStatus = (await getLoginStatuses(workspace, [accountName]))[accountName] as LoginStatus
  if (accountLoginStatus.isLoggedIn) {
    outputLine(formatLoginOverride, output)
  }
  try {
    await getLoginInputFlow(
      workspace,
      accountLoginStatus.configTypeOptions,
      output,
      authType,
      accountName,
      loginParameters,
    )
  } catch (e) {
    errorOutputLine(formatLoginToAccountFailed(accountName, e.message), output)
    return CliExitCode.AppError
  }
  return CliExitCode.Success
}

const accountLoginCommandDef: WorkspaceCommandDef<AccountLoginArgs> = {
  properties: {
    name: 'login',
    description:
      'Login to an application account of an environment.\n\nUse the --login-parameters option for non interactive execution.\n\nFor more information about supported login parameters please visit:\nhttps://github.com/salto-io/salto/blob/main/packages/cli/user_guide.md#non-interactive-execution',
    keyedOptions: [AUTH_TYPE_OPTION, ENVIRONMENT_OPTION, LOGIN_PARAMETER_OPTION],
    positionalOptions: [
      {
        name: 'accountName',
        type: 'string',
        description:
          'The name of the application account, usually same as service type unless specified differently when adding the account',
        required: true,
      },
    ],
  },
  action: loginAction,
  extraTelemetryTags: ({ workspace, input }) =>
    getTagsForAccounts({ workspace, accounts: [input.accountName], env: input.env }),
}

export const accountLoginDef = createWorkspaceCommand(accountLoginCommandDef)
const serviceLoginDef = createWorkspaceCommand(deprecatedCommandDef(accountLoginCommandDef))

const serviceGroupDef = createCommandGroupDef({
  properties: {
    name: 'service',
    description: 'Manage the environment accounts (DEPRECATED, use `account` command instead)',
  },
  subCommands: [serviceAddDef, serviceListDef, serviceLoginDef],
})

const accountGroupDef = createCommandGroupDef({
  properties: {
    name: 'account',
    description: 'Manage the environment accounts',
  },
  subCommands: [accountAddDef, accountListDef, accountLoginDef],
})

export { serviceGroupDef, accountGroupDef }
