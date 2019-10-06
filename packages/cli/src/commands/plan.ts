import { plan, Workspace } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { createPlanOutput } from '../formatter'

export const command = (
  workingDir: string,
  blueprintFiles: string[] = [],
  { stdout }: CliOutput
): CliCommand => ({
  async execute(): Promise<void> {
    const workspace: Workspace = await Workspace.load(workingDir, blueprintFiles)
    // TODO: inline commands.plan here
    stdout.write(createPlanOutput(await plan(workspace)))
  },
})

type PlanArgs = {
  'blueprint': string[]
  'blueprints-dir': string
}
type PlanParsedCliInput = ParsedCliInput<PlanArgs>

const builder = createCommandBuilder({
  options: {
    command: 'plan',
    aliases: ['p'],
    description: 'Shows changes to be applied to the target services at the next run of the *apply* command',
    keyed: {
      'blueprints-dir': {
        alias: 'd',
        describe: 'A path to the blueprints directory',
        string: true,
        demandOption: true,
      },
      blueprint: {
        alias: 'b',
        describe: 'Path to input blueprint file. This option can be specified multiple times',
        demandOption: false,
        array: true,
        requiresArg: true,
      },
    },
  },

  filters: [],

  async build(input: PlanParsedCliInput, output: CliOutput) {
    return command(input.args['blueprints-dir'], input.args.blueprint, output)
  },
})

export default builder
