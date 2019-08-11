import { EOL } from 'os'
import { CliInput, CliOutput, CliExitCode } from './types'
import { YargsCommandBuilder, allBuilders } from './builder'
import parse from './argparser'

export default async (
  input: CliInput,
  output: CliOutput,
  commandBuilders: YargsCommandBuilder[] = allBuilders,
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
    output.stderr.write(`Caught exception: ${[err, err.stack].filter(n => n).join(EOL)}`)
    output.stderr.write(EOL)
    return 2
  }
}
