/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import os from 'os'
import { Writable } from 'stream'
import { dynamoDbRepo, Repo } from '@salto-io/persistent-pool'
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
    const E : Error = e as Error
    writeLine(stderr, E.stack || E.message)
    return exit(2)
  }
}

export default main
