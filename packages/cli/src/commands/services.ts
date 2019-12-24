import _ from 'lodash'
import { addAdapter, loginAdapter } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { CliOutput, ParsedCliInput, CliCommand, CliExitCode } from '../types'
import { loadWorkspace } from '../workspace'
import { getConfigWithHeader } from '../callbacks'

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
    throw new Error('Service already exists for this workspace')
  }
  await addAdapter(workspaceDir, serviceName) // TODO: Need to fill config!
  stdout.write(`${serviceName} added to the workspace`)
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
      stdout.write(`${serviceName} is configured in this workspace\n`)
    } else {
      stdout.write(`${serviceName} is not configured in this workspace\n`)
    }
  } else {
    stdout.write(`The configured services are: ${workspace.config.services}\n`)
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
  // TODO: What happens if it's already logged in
  await loginAdapter(workspace, _.partial(getConfigWithHeader, stdout), serviceName)
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
        throw new Error('Unknown command')
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
    command: 'services [command] [name]',
    description: 'Manage your workspace services',
    positional: {
      command: {
        type: 'string',
        description: 'The command - add, login or list',
        default: '',
      },
      name: {
        type: 'string',
        description: 'The name of the service (required for add & login)',
        default: undefined,
      },
    },
  },

  async build(input: ServiceParsedCliInput, output: CliOutput) {
    return command('.', input.args.command, input.args.name, output)
  },
})

export default servicesBuilder
