import yargs from 'yargs'
import { promises } from '@salto/lowerdash'
import builders from './commands/index'
import { CommandBuilder, YargsCommandBuilder } from './command_builder'

const { promiseWithState } = promises.state

const registerBuilder = (
  yargsParser: yargs.Argv, { yargsModule, build }: YargsCommandBuilder
): Promise<CommandBuilder> =>
  new Promise<CommandBuilder>(resolved => yargsParser.command({
    ...yargsModule,
    handler: () => resolved(build),
  }))

export const registerBuilders = (
  parser: yargs.Argv, allBuilders: YargsCommandBuilder[] = builders
): promises.state.PromiseWithState<CommandBuilder> =>
  promiseWithState(Promise.race(allBuilders.map(builder => registerBuilder(parser, builder))))
