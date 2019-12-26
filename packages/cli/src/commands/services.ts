import _ from 'lodash'
import { EOL } from 'os'
import { addAdapter, loginAdapter } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { CliOutput, ParsedCliInput, CliCommand, CliExitCode } from '../types'
import { loadWorkspace } from '../workspace'
import { getConfigWithHeader } from '../callbacks'
import { serviceCmdFilter } from '../filters/services'
import {
  formatServiceConfigured, formatServiceNotConfigured, formatConfiguredServices,
  formatLoginUpdated, formatLoginOverride, formatServiceAdded,
} from '../formatter'

const addService = async (
  workspaceDir: string,
  serviceName: string,
  { stdout, stderr }: CliOutput
): Promise<CliExitCode> => {
  const { workspace, errored } = await loadWorkspace(workspaceDir,
    { stdout, stderr })
  if (errored) {
    return CliExitCode.AppError
  }

  if (workspace.config.services.includes(serviceName)) {
    throw new Error('Service was already added to this workspace.')
  }
  await addAdapter(workspaceDir, serviceName)
  stdout.write(formatServiceAdded(serviceName))
  await loginAdapter(workspace, _.partial(getConfigWithHeader, stdout), serviceName)
  return CliExitCode.Success
}

const listServices = async (
  workspaceDir: string,
  serviceName: string,
  { stdout, stderr }: CliOutput
): Promise<CliExitCode> => {
  const { workspace, errored } = await loadWorkspace(workspaceDir, { stdout, stderr })
  if (errored) {
    return CliExitCode.AppError
  }
  if (serviceName) {
    if (workspace.config.services.includes(serviceName)) {
      stdout.write(formatServiceConfigured(serviceName))
    } else {
      stdout.write(formatServiceNotConfigured(serviceName))
    }
  } else {
    stdout.write(formatConfiguredServices(workspace.config.services))
  }

  return CliExitCode.Success
}

const loginService = async (
  workspaceDir: string,
  serviceName: string,
  { stdout, stderr }: CliOutput
): Promise<CliExitCode> => {
  const { workspace, errored } = await loadWorkspace(workspaceDir,
    { stdout, stderr })
  if (errored) {
    return CliExitCode.AppError
  }
  if (!workspace.config.services.includes(serviceName)) {
    throw new Error('Service isn\'t configured for this workspace')
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
  serviceName: string,
  { stdout, stderr }: CliOutput
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    switch (commandName) {
      case 'add':
        return addService(workspaceDir, serviceName, { stdout, stderr })
      case 'list':
        return listServices(workspaceDir, serviceName, { stdout, stderr })
      case 'login':
        return loginService(workspaceDir, serviceName, { stdout, stderr })
      default:
        throw new Error('Unknown service management command')
    }
  },
})

type ServiceArgs = {
  name: string
  command: string
}

type ServiceParsedCliInput = ParsedCliInput<ServiceArgs>

const servicesBuilder = createCommandBuilder({
  options: {
    command: 'services <command> [name]',
    description: 'Manage your workspace services',
  },

  filters: [serviceCmdFilter],
  async build(input: ServiceParsedCliInput, output: CliOutput) {
    return command('.', input.args.command, input.args.name, output)
  },
})

export default servicesBuilder
