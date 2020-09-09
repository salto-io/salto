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
  addAdapter,
  getLoginStatuses,
  LoginStatus,
  updateCredentials,
  loadLocalWorkspace,
  getAdaptersCredentialsTypes,
} from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'

import { InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { outputLine, errorOutputLine } from '../outputer'
import { environmentFilter } from '../filters/env'
import { createCommandBuilder } from '../command_builder'
import { CliOutput, ParsedCliInput, CliCommand, CliExitCode, WriteStream } from '../types'
import { getCredentialsFromUser } from '../callbacks'
import { serviceCmdFilter, ServiceCmdArgs } from '../filters/service'
import {
  formatServiceConfigured, formatServiceNotConfigured, formatConfiguredServices,
  formatLoginUpdated, formatLoginOverride, formatServiceAdded,
  formatServiceAlreadyAdded, formatCredentialsHeader, formatLoginToServiceFailed,
} from '../formatter'
import { EnvironmentArgs } from './env'

const getLoginInputFlow = async (
  workspace: Workspace,
  configType: ObjectType,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  stdout: WriteStream
): Promise<void> => {
  stdout.write(formatCredentialsHeader(configType.elemID.adapter))
  const newConfig = await getLoginInput(configType)
  await updateCredentials(workspace, newConfig)
  stdout.write(EOL)
  outputLine(formatLoginUpdated, { stdout })
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
  { stdout, stderr }: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  serviceName: string,
  inputEnvironment?: string,
  nologin?: boolean
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workspaceDir, inputEnvironment)
  if (workspace.services().includes(serviceName)) {
    errorOutputLine(formatServiceAlreadyAdded(serviceName), { stderr })
    return CliExitCode.UserInputError
  }

  if (!nologin) {
    const adapterCredentialsType = getAdaptersCredentialsTypes([serviceName])[serviceName]
    try {
      await getLoginInputFlow(workspace, adapterCredentialsType, getLoginInput, stdout)
    } catch (e) {
      errorOutputLine(formatLoginToServiceFailed(serviceName, e.message), { stderr })
      return CliExitCode.AppError
    }
  }

  await addAdapter(workspace, serviceName)
  outputLine(formatServiceAdded(serviceName), { stdout })
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
  { stdout, stderr }: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  serviceName: string,
  inputEnvironment?: string,
): Promise<CliExitCode> => {
  const workspace = await loadWorkspace(workspaceDir, inputEnvironment)
  if (!workspace.services().includes(serviceName)) {
    errorOutputLine(formatServiceNotConfigured(serviceName), { stderr })
    return CliExitCode.AppError
  }
  const serviceLoginStatus = (await getLoginStatuses(
    workspace,
    [serviceName]
  ))[serviceName] as LoginStatus
  if (serviceLoginStatus.isLoggedIn) {
    outputLine(formatLoginOverride, { stdout })
  }
  await getLoginInputFlow(workspace, serviceLoginStatus.configType, getLoginInput, stdout)
  return CliExitCode.Success
}

export const command = (
  workspaceDir: string,
  commandName: string,
  { stdout, stderr }: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  serviceName = '',
  inputEnvironment?: string,
  nologin?: boolean
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    switch (commandName) {
      case 'add':
        return addService(
          workspaceDir,
          { stdout, stderr },
          getLoginInput,
          serviceName,
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
          inputEnvironment
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
      input.args.name,
      input.args.env,
      input.args.nologin,
    )
  },
})

export default servicesBuilder
