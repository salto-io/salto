/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { EOL } from 'os'
import { Writable } from 'stream'

export const writeLine = (stream: Writable, s = ''): void => {
  stream.write(s)
  stream.write(EOL)
}

export const terminalWidth = (s: Writable): number | undefined => (s as NodeJS.WriteStream).columns
