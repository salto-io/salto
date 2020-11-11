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
import { AdapterAuthMethod, AdapterAuthentication, InstanceElement, ObjectType, OAuthMethod, ElemID } from '@salto-io/adapter-api'
import _ from 'lodash'
import { EOL } from 'os'
import { addAdapter, getLoginStatuses, LoginStatus, updateCredentials, loadLocalWorkspace, getAdaptersCredentialsTypes, installAdapter } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { getCredentialsFromUser } from '../callbacks'
import { CliOutput, CliExitCode } from '../types'
import { createCommandGroupDef, createPublicCommandDef, DefActionInput } from '../command_builder'
import { formatServiceAlreadyAdded, formatServiceAdded, formatLoginToServiceFailed, formatCredentialsHeader, formatLoginUpdated, formatConfiguredServices, formatServiceNotConfigured, formatLoginOverride } from '../formatter'
import { errorOutputLine, outputLine } from '../outputer'
import { processOauthCredentials } from '../cli_oauth_authenticator'
import { EnvArg, ENVIORMENT_OPTION } from './commons/env'

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
      oauthParameters.accessTokenField, oauthParameters.url, output))
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
): Promise<void> => {
  const newConfig = await getConfigFromInput(authType, authMethods, output, getCredentialsFromUser)
  await updateCredentials(workspace, newConfig)
  output.stdout.write(EOL)
  outputLine(formatLoginUpdated, output)
}

const loadWorkspace = async (workspaceDir: string, inputEnvironment?: string):
Promise<Workspace> => {
  const workspace = await loadLocalWorkspace(workspaceDir)
  if (!_.isUndefined(inputEnvironment)) {
    await workspace.setCurrentEnv(inputEnvironment, false)
  }
  return workspace
}

// Add
type ServiceAddArgs = {
    login: boolean
    serviceName: string
    authType: AdapterAuthMethod
} & EnvArg

const addAction = async (
  {
    input: { login, serviceName, authType, env },
    output,
    workingDir = '.',
  }: DefActionInput<ServiceAddArgs>,
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workingDir, env)
  if (workspace.services().includes(serviceName)) {
    errorOutputLine(formatServiceAlreadyAdded(serviceName), output)
    return CliExitCode.UserInputError
  }

  await installAdapter(serviceName)
  if (login) {
    const adapterCredentialsTypes = getAdaptersCredentialsTypes([serviceName])[serviceName]
    try {
      await getLoginInputFlow(workspace, adapterCredentialsTypes, output, authType)
    } catch (e) {
      errorOutputLine(formatLoginToServiceFailed(serviceName, e.message), output)
      return CliExitCode.AppError
    }
  }

  await addAdapter(workspace, serviceName)
  outputLine(formatServiceAdded(serviceName), output)
  return CliExitCode.Success
}

const serviceAddDef = createPublicCommandDef({
  properties: {
    name: 'add',
    description: 'Add a new service to the environment',
    options: [
      {
        // Will be replaced with --no-login
        name: 'login',
        default: true,
        alias: 'n',
        type: 'boolean',
        description: 'Do not login to service when adding it. Example usage: \'service add <service-name> --no-login\'.',
        required: false,
      },
      {
        name: 'authType',
        alias: 'a',
        description: 'The type of authorization you would like to use for the service',
        type: 'string',
        required: false,
        default: 'basic',
      },
      ENVIORMENT_OPTION,
    ],
    positionals: [
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
type SeriveListArgs = {} & EnvArg

const listAction = async (
  { input: { env }, output, workingDir = '.' }: DefActionInput<SeriveListArgs>,
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workingDir, env)
  outputLine(formatConfiguredServices(workspace.services()), output)
  return CliExitCode.Success
}

const serviceListDef = createPublicCommandDef({
  properties: {
    name: 'list',
    description: 'List environment services',
    options: [
      ENVIORMENT_OPTION,
    ],
  },
  action: listAction,
})

// Login
type ServiceLoginArgs = {
    serviceName: string
    authType: AdapterAuthMethod
} & EnvArg

const loginAction = async (
  {
    input: { serviceName, authType, env },
    output,
    workingDir = '.',
  }: DefActionInput<ServiceLoginArgs>
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workingDir, env)
  if (!workspace.services().includes(serviceName)) {
    errorOutputLine(formatServiceNotConfigured(serviceName), output)
    return CliExitCode.AppError
  }
  const serviceLoginStatus = (await getLoginStatuses(
    workspace,
    [serviceName]
  ))[serviceName] as LoginStatus
  if (serviceLoginStatus.isLoggedIn) {
    outputLine(formatLoginOverride, output)
  }
  try {
    await getLoginInputFlow(workspace, serviceLoginStatus.configTypeOptions, output, authType)
  } catch (e) {
    errorOutputLine(formatLoginToServiceFailed(serviceName, e.message), output)
    return CliExitCode.AppError
  }
  return CliExitCode.Success
}

const serviceLoginDef = createPublicCommandDef({
  properties: {
    name: 'login',
    description: 'Set the environment service credentials',
    options: [
      {
        name: 'authType',
        alias: 'a',
        description: 'The type of authorization you would like to use for the service',
        type: 'string',
        required: false,
        default: 'basic',
      },
      ENVIORMENT_OPTION,
    ],
    positionals: [
      {
        name: 'serviceName',
        type: 'string',
        description: 'The name of the service',
        required: true,
      },
    ],
  },
  action: loginAction,
})

const serviceGroupDef = createCommandGroupDef({
  properties: {
    name: 'service',
    description: 'Manage the environment services',
  },
  subCommands: [
    serviceAddDef,
    serviceListDef,
    serviceLoginDef,
  ],
})

export default serviceGroupDef
