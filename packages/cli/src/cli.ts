import { EOL } from 'os'
import chalk from 'chalk'
import { streams } from '@salto/lowerdash'
import { CliInput, CliOutput, CliExitCode } from './types'
import { YargsCommandBuilder } from './command_builder'
import builders from './commands/index'
import parse from './argparser'

export default async (
  input: CliInput,
  output: CliOutput,
  commandBuilders: YargsCommandBuilder[] = builders,
): Promise<CliExitCode> => {
  try {
    const parseResult = await parse(commandBuilders, input, output)

    if (parseResult.status === 'error') {
      return 1
    }

    if (parseResult.status === 'command') {
      const { parsedArgs, builder: commandBuilder } = parseResult
      const parsedInput = { ...input, args: parsedArgs }
      const command = await commandBuilder(parsedInput, output)
      await command.execute()
    }

    return 0
  } catch (err) {
    const errorStream = output.stderr
    const unstyledErrorString = `${[err].filter(n => n).join(EOL)}`
    const errorString = streams.hasColors(errorStream)
      ? chalk.bold.red(unstyledErrorString) : unstyledErrorString
    errorStream.write(errorString)
    errorStream.write(EOL)
    return 2
  }
}
