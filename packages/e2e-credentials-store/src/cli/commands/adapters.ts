/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Writable } from 'stream'
import { CommandModule } from 'yargs'
import { Adapter } from '../../types'
import { writeLine } from '../stream'

type Opts = {
  adapters: Record<string, Adapter>
  stdout: Writable
}

const commandModule = ({ adapters, stdout }: Opts): CommandModule<never, never> => ({
  command: 'adapters',
  describe: 'list adapters',
  builder: args => args,
  handler: () => {
    Object.keys(adapters).forEach(adapterName => writeLine(stdout, adapterName))
  },
})

export default commandModule
