import * as path from 'path'
import { init } from 'salto'
import Prompts from '../prompts'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { getEnvName } from '../callbacks'

export const command = (
  workspaceName: string | undefined,
  { stdout, stderr }: CliOutput,
  getEnvNameCallback: (currentEnvName: string) => Promise<string>
): CliCommand => ({
  async execute(): Promise<CliExitCode> {
    try {
      const defaultEnvName = await getEnvNameCallback('default')
      const workspace = await init(workspaceName, defaultEnvName)
      stdout.write(
        Prompts.initCompleted(workspace.config.name, path.resolve(workspace.config.baseDir))
      )
    } catch (e) {
      stderr.write(Prompts.initFailed(e.message))
      return CliExitCode.AppError
    }
    return CliExitCode.Success
  },
})

type InitArgs = {
  'workspace-name': string
}

type InitParsedCliInput = ParsedCliInput<InitArgs>

const initBuilder = createCommandBuilder({
  options: {
    command: 'init [workspace-name]',
    description: 'Creates a new Salto workspace in the current directory',
    positional: {
      'workspace-name': {
        type: 'string',
        description: 'The name of the workspace',
        default: undefined, // Prevent "default: []" in the help
      },
    },
  },

  async build(input: InitParsedCliInput, output: CliOutput) {
    return command(input.args['workspace-name'], output, getEnvName)
  },
})

export default initBuilder
