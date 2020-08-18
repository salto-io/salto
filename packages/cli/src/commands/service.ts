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
import { EOL } from 'os'
import {
  addAdapter, getLoginStatuses, LoginStatus, updateCredentials, loadLocalWorkspace,
  getAdaptersCredentialsTypes, installAdapter,
} from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { InstanceElement, ObjectType, AdapterAuthentication, ElemID, OAuthMethod, AdapterAuthMethod } from '@salto-io/adapter-api'
import { outputLine, errorOutputLine } from '../outputer'
import { environmentFilter } from '../filters/env'
import { processOauthCredentials } from '../cli_oauth_authenticator'
import { createCommandBuilder } from '../command_builder'
import { CliOutput, ParsedCliInput, CliCommand, CliExitCode } from '../types'
import { getCredentialsFromUser } from '../callbacks'
import { serviceCmdFilter, ServiceCmdArgs } from '../filters/service'
import {
  formatServiceConfigured, formatServiceNotConfigured, formatConfiguredServices,
  formatLoginUpdated, formatLoginOverride, formatServiceAdded, formatServiceAlreadyAdded,
  formatCredentialsHeader, formatLoginToServiceFailed,
} from '../formatter'
import { EnvironmentArgs } from './env'

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
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  output: CliOutput,
  authType: AdapterAuthMethod,
): Promise<void> => {
  const newConfig = await getConfigFromInput(authType, authMethods, output, getLoginInput)
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

const addService = async (
  workspaceDir: string,
  output: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  serviceName: string,
  authType: AdapterAuthMethod,
  inputEnvironment?: string,
  nologin?: boolean,
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workspaceDir, inputEnvironment)
  if (workspace.services().includes(serviceName)) {
    errorOutputLine(formatServiceAlreadyAdded(serviceName), output)
    return CliExitCode.UserInputError
  }

  await installAdapter(serviceName)
  if (!nologin) {
    const adapterCredentialsTypes = getAdaptersCredentialsTypes([serviceName])[serviceName]
    try {
      await getLoginInputFlow(workspace, adapterCredentialsTypes,
        getLoginInput, output, authType)
    } catch (e) {
      errorOutputLine(formatLoginToServiceFailed(serviceName, e.message), output)
      return CliExitCode.AppError
    }
  }

  await addAdapter(workspace, serviceName)
  outputLine(formatServiceAdded(serviceName), output)
  return CliExitCode.Success
}

const listServices = async (
  workspaceDir: string,
  cliOutput: CliOutput,
  serviceName: string,
  inputEnvironment?: string,
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workspaceDir, inputEnvironment)
  if (_.isEmpty(serviceName)) {
    outputLine(formatConfiguredServices(workspace.services()), cliOutput)
  } else if (workspace.services().includes(serviceName)) {
    outputLine(formatServiceConfigured(serviceName), cliOutput)
  } else {
    outputLine(formatServiceNotConfigured(serviceName), cliOutput)
  }
  return CliExitCode.Success
}

const loginService = async (
  workspaceDir: string,
  output: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  serviceName: string,
  authType: AdapterAuthMethod,
  inputEnvironment?: string,
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workspaceDir, inputEnvironment)
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
    await getLoginInputFlow(workspace, serviceLoginStatus.configTypeOptions,
      getLoginInput, output, authType)
  } catch (e) {
    errorOutputLine(formatLoginToServiceFailed(serviceName, e.message), output)
    return CliExitCode.AppError
  }
  return CliExitCode.Success
}

export const command = (
  workspaceDir: string,
  commandName: string,
  { stdout, stderr }: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  authType: AdapterAuthMethod,
  serviceName = '',
  inputEnvironment?: string,
  nologin?: boolean,
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    switch (commandName) {
      case 'add':
        return addService(
          workspaceDir,
          { stdout, stderr },
          getLoginInput,
          serviceName,
          authType,
          inputEnvironment,
          nologin,
        )
      case 'list':
        return listServices(workspaceDir, { stdout, stderr }, serviceName, inputEnvironment)
      case 'login':
        return loginService(
          workspaceDir,
          { stdout, stderr },
          getLoginInput,
          serviceName,
          authType,
          inputEnvironment,
        )
      default:
        throw new Error('Unknown service management command')
    }
  },
})

type ServiceArgs = {} & ServiceCmdArgs & EnvironmentArgs

type ServiceParsedCliInput = ParsedCliInput<ServiceArgs>

const servicesBuilder = createCommandBuilder({
  options: {
    command: 'service <command> [name]',
    description: 'Manage your environment services',
    keyed: {
      nologin: {
        alias: ['n'],
        describe: 'Do not login to service when adding it. Example usage: \'service add <service-name> --nologin\'.',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  filters: [serviceCmdFilter, environmentFilter],
  async build(input: ServiceParsedCliInput, output: CliOutput) {
    return command(
      '.',
      input.args.command,
      output,
      getCredentialsFromUser,
      input.args.authType as AdapterAuthMethod,
      input.args.name,
      input.args.env,
      input.args.nologin,
    )
  },
})

export default servicesBuilder
