import { Writable } from 'stream'
import { CommandModule } from 'yargs'
import { Adapter } from '../../types'
import { writeLine } from '../stream'

type Opts = {
  adapters: Record<string, Adapter>
  stdout: Writable
}

const commandModule = ({
  adapters,
  stdout,
}: Opts): CommandModule<never, never> => ({
  command: 'adapters',
  describe: 'list adapters',
  builder: args => args,
  handler: () => {
    Object.keys(adapters).forEach(adapterName => writeLine(stdout, adapterName))
  },
})

export default commandModule
