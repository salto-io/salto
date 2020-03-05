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
  loadConfig,
  getLoginStatuses,
  LoginStatus,
  updateLoginConfig,
  Workspace,
  currentEnvConfig,
} from '@salto-io/core'

import { InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createCommandBuilder } from '../command_builder'
import { CliOutput, ParsedCliInput, CliCommand, CliExitCode, WriteStream } from '../types'
import { loadWorkspace } from '../workspace'
import { getCredentialsFromUser } from '../callbacks'
import { serviceCmdFilter, ServiceCmdArgs } from '../filters/services'
import {
  formatServiceConfigured, formatServiceNotConfigured, formatConfiguredServices,
  formatLoginUpdated, formatLoginOverride, formatServiceAdded,
  formatServiceAlreadyAdded, formatCredentialsHeader, formatLoginToServiceFailed,
} from '../formatter'

const getLoginInputFlow = async (
  workspace: Workspace,
  configType: ObjectType,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  stdout: WriteStream
): Promise<void> => {
  stdout.write(formatCredentialsHeader(configType.elemID.adapter))
  const newConfig = await getLoginInput(configType)
  await updateLoginConfig(workspace, newConfig)
  stdout.write(EOL)
  stdout.write(formatLoginUpdated)
}

const addService = async (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  serviceName: string,
): Promise<CliExitCode> => {
  const { workspace, errored } = await loadWorkspace(workspaceDir,
    { stdout, stderr })
  if (errored) {
    return CliExitCode.AppError
  }
  if (currentEnvConfig(workspace.config).services.includes(serviceName)) {
    stderr.write(formatServiceAlreadyAdded(serviceName))
    return CliExitCode.UserInputError
  }

  const adapterConfigType = await addAdapter(workspaceDir, serviceName)
  stdout.write(formatServiceAdded(serviceName))

  try {
    await getLoginInputFlow(workspace, adapterConfigType, getLoginInput, stdout)
  } catch (e) {
    stderr.write(formatLoginToServiceFailed(serviceName, e.message))
  }

  return CliExitCode.Success
}

const listServices = async (
  workspaceDir: string,
  { stdout }: CliOutput,
  serviceName: string,
): Promise<CliExitCode> => {
  const workspaceConfig = await loadConfig(workspaceDir)
  const { services } = currentEnvConfig(workspaceConfig)
  if (_.isEmpty(serviceName)) {
    stdout.write(formatConfiguredServices(services))
  } else if (services.includes(serviceName)) {
    stdout.write(formatServiceConfigured(serviceName))
  } else {
    stdout.write(formatServiceNotConfigured(serviceName))
  }
  return CliExitCode.Success
}

const loginService = async (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  serviceName: string,
): Promise<CliExitCode> => {
  const { workspace, errored } = await loadWorkspace(workspaceDir,
    { stdout, stderr })
  if (errored) {
    return CliExitCode.AppError
  }
  if (!currentEnvConfig(workspace.config).services.includes(serviceName)) {
    stderr.write(formatServiceNotConfigured(serviceName))
    return CliExitCode.AppError
  }
  const serviceLoginStatus = (await getLoginStatuses(
    workspace,
    [serviceName]
  ))[serviceName] as LoginStatus
  if (serviceLoginStatus.isLoggedIn) {
    stdout.write(formatLoginOverride)
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
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    switch (commandName) {
      case 'add':
        return addService(workspaceDir, { stdout, stderr }, getLoginInput, serviceName)
      case 'list':
        return listServices(workspaceDir, { stdout, stderr }, serviceName)
      case 'login':
        return loginService(workspaceDir, { stdout, stderr }, getLoginInput, serviceName)
      default:
        throw new Error('Unknown service management command')
    }
  },
})

type ServiceArgs = {} & ServiceCmdArgs

type ServiceParsedCliInput = ParsedCliInput<ServiceArgs>

const servicesBuilder = createCommandBuilder({
  options: {
    command: 'services <command> [name]',
    description: 'Manage your workspace services',
  },

  filters: [serviceCmdFilter],
  async build(input: ServiceParsedCliInput, output: CliOutput) {
    return command('.', input.args.command, output, getCredentialsFromUser, input.args.name)
  },
})

export default servicesBuilder
