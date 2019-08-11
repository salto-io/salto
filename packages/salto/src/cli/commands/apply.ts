import * as commands from '../commands'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const command = (blueprints: Blueprint[], force: boolean): CliCommand => ({
  async execute(): Promise<void> {
    return commands.applyBase(() => Promise.resolve(blueprints), force)
  },
})

type Args = bf.Args & { yes: boolean }
type MyParsedCliInput = ParsedCliInput<Args> & bf.MyParsedCliInput

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

  async build(input: MyParsedCliInput, _output: CliOutput) {
    return command(input.blueprints, input.args.yes)
  },
})

export default builder
