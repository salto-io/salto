import * as commands from '../commands'
import { createCommandBuilder } from '../builder'
import { CliCommand, CliOutput, ParsedCliInput } from '../types'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const command = (blueprints: Blueprint[], force: boolean): CliCommand => ({
  async execute(): Promise<void> {
    return commands.applyBase(() => Promise.resolve(blueprints), force)
  },
})

type ApplyArgs = bf.Args & { yes: boolean }
type ApplyParsedCliInput = ParsedCliInput<ApplyArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'apply',
    aliases: ['a'],
    description: 'Applies changes to the target services',
    keyed: {
      yes: {
        describe: 'Do not ask for approval before applying',
        boolean: true,
      },
    },
  },

  filters: [bf.requiredFilter],

  async build(input: ApplyParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args.yes)
  },
})

export default builder
