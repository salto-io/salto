import { plan, Blueprint } from 'salto'
import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { createPlanOutput } from '../formatter'
import * as bf from '../filters/blueprints'

export const command = (blueprints: Blueprint[], { stdout }: CliOutput): CliCommand => ({
  async execute(): Promise<void> {
    // TODO: inline commands.plan here
    stdout.write(createPlanOutput(await plan(blueprints)))
  },
})

type PlanArgs = bf.Args
type PlanParsedCliInput = ParsedCliInput<PlanArgs> & bf.BlueprintsParsedCliInput

const builder = createCommandBuilder({
  options: {
    command: 'plan',
    aliases: ['p'],
    description: 'Shows changes to be applied to the target services at the next run of the *apply* command',
  },

  filters: [bf.requiredFilter],

  async build(input: PlanParsedCliInput, output: CliOutput) {
    return command(input.blueprints, output)
  },
})

export default builder
