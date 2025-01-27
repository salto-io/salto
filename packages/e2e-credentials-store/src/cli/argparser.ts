/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Writable } from 'stream'
import yargs from 'yargs/yargs'
import { Arguments, CommandModule } from 'yargs'
import { Pool, Repo } from '@salto-io/persistent-pool'
import { Adapter, PoolOpts } from '../types'
import { terminalWidth, writeLine } from './stream'
import { CliReturnCode } from './types'
import commands from './commands'
import REPO_PARAMS from '../repo_params'

type Parser = (argv: string[]) => Promise<CliReturnCode>

type ParserOpts = {
  adapters: Record<string, Adapter>
  stdout: Writable
  stderr: Writable
  createRepo: (tableName: string) => Promise<Repo>
}

const MAX_WIDTH = 100

const argparser = ({ adapters, stdout, stderr, createRepo }: ParserOpts): Parser => {
  const parser = yargs()

  let errorMessage: string | undefined

  parser
    .strict()
    .demandCommand()
    .options({
      table: {
        alias: 't',
        type: 'string',
        default: REPO_PARAMS.tableName,
      },
    })
    .exitProcess(false)
    .fail((msg, err) => {
      // istanbul ignore if
      if (err) throw err
      errorMessage = msg
    })
    .wrap(Math.min(terminalWidth(stdout) ?? MAX_WIDTH, MAX_WIDTH) - 1)

  const pool = async ({ globalArgs, adapterName }: PoolOpts): Promise<Pool> => {
    const repo = await createRepo(globalArgs.table)
    return repo.pool(adapterName)
  }

  let commandPromise: Promise<CliReturnCode> | undefined

  const asyncHandler =
    <T>(handler: (argv: Arguments<T>) => Promise<CliReturnCode>): ((args: Arguments<T>) => void) =>
    args => {
      commandPromise = handler(args)
    }

  const commandContext = { adapters, pool, asyncHandler, stdout, stderr }

  Object.keys(commands)
    .map(c => commands[c as keyof typeof commands](commandContext) as CommandModule)
    .forEach(c => parser.command(c))

  const showHelp = (
    stream: Writable,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
  ): void => parser.showHelp(s => writeLine(stream, `Usage: ${s}`))

  return async argv =>
    new Promise<CliReturnCode>((resolve, reject) => {
      parser.parse(argv, {}, (err, _parsedArgs, outText): void => {
        // istanbul ignore if
        if (err) {
          reject(err)
          return
        }

        if (errorMessage !== undefined) {
          writeLine(stderr, errorMessage)
          writeLine(stderr)
          showHelp(stderr)
          resolve(1)
          return
        }

        if (outText) {
          writeLine(stdout, outText)
          resolve(0)
          return
        }

        resolve(commandPromise ?? 0)
      })
    })
}

export default argparser
