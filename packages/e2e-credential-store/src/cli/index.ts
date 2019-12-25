import os from 'os'
import { Writable } from 'stream'
import { dynamoDbRepo, Repo } from '@salto/persistent-pool'
import argparser from './argparser'
import { Adapter } from '../types'
import REPO_PARAMS from '../repo_params'
import { writeLine } from './stream'

export type Process = {
  stdout: Writable
  stderr: Writable
  argv: string[]
  exit: (code: number) => never
}

export type Opts = {
  adapters: Record<string, Adapter>
  process?: Process
  createRepo?: (tableName: string) => Promise<Repo>
}

const createRealRepo = (tableName: string): Promise<Repo> => dynamoDbRepo({
  clientId: os.hostname(),
  ...REPO_PARAMS,
  tableName,
})

const main = async ({
  adapters,
  process = global.process,
  createRepo = createRealRepo,
}: Opts): Promise<never> => {
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
