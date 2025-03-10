/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import os from 'os'
import { Writable } from 'stream'
import { dynamoDbRepo, Repo } from '@salto-io/persistent-pool'
import argparser from './argparser'
import { Adapter } from '../types'
import REPO_PARAMS from '../repo_params'
import { writeLine } from './stream'

type Process = {
  stdout: Writable
  stderr: Writable
  argv: string[]
  exit: (code: number) => never
}

type Opts = {
  adapters: Record<string, Adapter>
  process?: Process
  createRepo?: (tableName: string) => Promise<Repo>
}

const createRealRepo = (tableName: string): Promise<Repo> =>
  dynamoDbRepo({
    clientId: os.hostname(),
    ...REPO_PARAMS,
    tableName,
  })

const main = async ({ adapters, process = global.process, createRepo = createRealRepo }: Opts): Promise<never> => {
  const parser = argparser({ adapters, createRepo, ...process })
  const { argv, exit, stderr } = process
  try {
    const code = await parser(argv.slice(2))
    return exit(code)
  } catch (e) {
    writeLine(stderr, e.stack || e)
    return exit(2)
  }
}

export default main
