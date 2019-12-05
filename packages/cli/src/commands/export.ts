import path from 'path'
import { exportToCsv } from 'salto'
import Prompts from '../prompts'
import { createCommandBuilder } from '../command_builder'
import { ParsedCliInput, CliCommand, CliOutput, CliExitCode } from '../types'
import { getConfigFromUser } from '../callbacks'
import { loadWorkspace } from '../workspace'

export const command = (
  workingDir: string,
  typeName: string,
  outputPath: string,
  { stdout, stderr }: CliOutput
):
CliCommand => ({
  async execute(): Promise<CliExitCode> {
    const { workspace, errored } = await loadWorkspace(workingDir, { stdout, stderr })
    if (errored) {
      return CliExitCode.AppError
    }

    // Check if output path is provided, otherwise use the template
    // <working dir>/<typeName>_<current timestamp>.csv
    const outPath = outputPath || path.join(path.resolve('./'), `${typeName}_${Date.now()}.csv`)
    try {
      const exportedRows = await exportToCsv(typeName, outPath, workspace, getConfigFromUser)
      stdout.write(Prompts.EXPORT_FINISHED_SUMMARY(exportedRows, typeName, outputPath))
      return CliExitCode.Success
    } catch (error) {
      stderr.write(Prompts.OPERATION_FAILED_WITH_ERROR(error))
      return CliExitCode.AppError
    }
  },
})

type ExportArgs = {
  'type-name': string
  'output-path': string
 }
type ExportParsedCliInput = ParsedCliInput<ExportArgs>

const exportBuilder = createCommandBuilder({
  options: {
    command: 'export <type-name>',
    description: 'Downloads all records of the input type from the target service to a CSV file',
    positional: {
      'type-name': {
        type: 'string',
        description: 'The type name of the instances for export as it appears in the blueprint',
        default: undefined, // Prevent "default: []" in the help
      },
    },
    keyed: {
      'output-path': {
        alias: ['o'],
        describe: 'A path to the output CSV file',
        string: true,
        demandOption: false,
      },
    },
  },

  async build(input: ExportParsedCliInput, output: CliOutput) {
    return command('.', input.args['type-name'], input.args['output-path'], output)
  },
})

export default exportBuilder
