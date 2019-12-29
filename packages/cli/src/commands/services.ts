import _ from 'lodash'
import { EOL } from 'os'
import { addAdapter, loginAdapter } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { CliOutput, ParsedCliInput, CliCommand, CliExitCode } from '../types'
import { loadWorkspace } from '../workspace'
import { getConfigWithHeader } from '../callbacks'
import { serviceCmdFilter, ServiceCmdArgs } from '../filters/services'
import {
  formatServiceConfigured, formatServiceNotConfigured, formatConfiguredServices,
  formatLoginUpdated, formatLoginOverride, formatServiceAdded, formatServiceAlreadyAdded,
} from '../formatter'

const addService = async (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
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
  await addAdapter(workspaceDir, serviceName)
  stdout.write(formatServiceAdded(serviceName))
  const didLogin = await loginAdapter(
    workspace,
    _.partial(getConfigWithHeader, stdout),
    serviceName
  )
  if (didLogin) {
    stdout.write(formatLoginUpdated)
  }
  return CliExitCode.Success
}

const listServices = async (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  serviceName: string,
): Promise<CliExitCode> => {
  const { workspace, errored } = await loadWorkspace(workspaceDir, { stdout, stderr })
  if (errored) {
    return CliExitCode.AppError
  }
  if (_.isEmpty(serviceName)) {
    stdout.write(formatConfiguredServices(workspace.config.services))
  } else if (workspace.config.services.includes(serviceName)) {
    stdout.write(formatServiceConfigured(serviceName))
  } else {
    stdout.write(formatServiceNotConfigured(serviceName))
  }
  return CliExitCode.Success
}

const loginService = async (
  workspaceDir: string,
  { stdout, stderr }: CliOutput,
  serviceName: string,
): Promise<CliExitCode> => {
  const { workspace, errored } = await loadWorkspace(workspaceDir,
    { stdout, stderr })
  if (errored) {
    return CliExitCode.AppError
  }
  if (!workspace.config.services.includes(serviceName)) {
    stderr.write(formatServiceNotConfigured(serviceName))
  }
  const didLogin = await loginAdapter(
    workspace,
    _.partial(getConfigWithHeader, stdout),
    serviceName
  )
  if (didLogin) {
    stdout.write(formatLoginUpdated)
  } else {
    stdout.write(formatLoginOverride)
    await loginAdapter(
      workspace,
      _.partial(getConfigWithHeader, stdout),
      serviceName,
      true
    )
    stdout.write(EOL)
    stdout.write(formatLoginUpdated)
  }
  return CliExitCode.Success
}

export const command = (
  workspaceDir: string,
  commandName: string,
  { stdout, stderr }: CliOutput,
  serviceName = '',
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    switch (commandName) {
      case 'add':
        return addService(workspaceDir, { stdout, stderr }, serviceName)
      case 'list':
        return listServices(workspaceDir, { stdout, stderr }, serviceName)
      case 'login':
        return loginService(workspaceDir, { stdout, stderr }, serviceName)
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
    return command('.', input.args.command, output, input.args.name)
  },
})

export default servicesBuilder
