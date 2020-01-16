import _ from 'lodash'
import { EOL } from 'os'
import { addAdapter, loadConfig, getLoginStatuses, LoginStatus, updateLoginConfig, Workspace } from 'salto'
import { InstanceElement, ObjectType } from 'adapter-api'
import { createCommandBuilder } from '../command_builder'
import { CliOutput, ParsedCliInput, CliCommand, CliExitCode, WriteStream } from '../types'
import { loadWorkspace } from '../workspace'
import { getConfigFromUser } from '../callbacks'
import { serviceCmdFilter, ServiceCmdArgs } from '../filters/services'
import {
  formatServiceConfigured, formatServiceNotConfigured, formatConfiguredServices,
  formatLoginUpdated, formatLoginOverride, formatServiceAdded,
  formatServiceAlreadyAdded, formatConfigHeader,
} from '../formatter'

const getLoginInputFlow = async (
  workspace: Workspace,
  configType: ObjectType,
  getLoginInput: (configType: ObjectType) => Promise<InstanceElement>,
  stdout: WriteStream
): Promise<void> => {
  stdout.write(formatConfigHeader(configType.elemID.adapter))
  const newConfig = await getLoginInput(configType)
  await updateLoginConfig(workspace, [newConfig])
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
  if (workspace.config.services.includes(serviceName)) {
    stderr.write(formatServiceAlreadyAdded(serviceName))
    return CliExitCode.UserInputError
  }
  const adapterConfigType = await addAdapter(workspaceDir, serviceName)
  stdout.write(formatServiceAdded(serviceName))
  await getLoginInputFlow(workspace, adapterConfigType, getLoginInput, stdout)
  return CliExitCode.Success
}

const listServices = async (
  workspaceDir: string,
  { stdout }: CliOutput,
  serviceName: string,
): Promise<CliExitCode> => {
  const workspaceConfig = await loadConfig(workspaceDir)
  if (_.isEmpty(serviceName)) {
    stdout.write(formatConfiguredServices(workspaceConfig.services))
  } else if (workspaceConfig.services.includes(serviceName)) {
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
  if (!workspace.config.services.includes(serviceName)) {
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
    return command('.', input.args.command, output, getConfigFromUser, input.args.name)
  },
})

export default servicesBuilder
