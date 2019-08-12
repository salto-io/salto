import { createCommandBuilder } from '../builder'
import { ParsedCliInput, CliCommand, CliOutput } from '../types'
import { createPlanOutput } from '../formatter'
import * as commands from '../../core/commands'
import { Blueprint } from '../../blueprints/blueprint'
import * as bf from '../filters/blueprints'

const planTask = (blueprints: Blueprint[], { stdout }: CliOutput): CliCommand => ({
  async execute(): Promise<void> {
    // TODO: inline commands.plan here
    const plan = await commands.plan(blueprints)
    stdout.write(createPlanOutput(plan))
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
    return planTask(input.blueprints, output)
  },
})

export default builder
