import { promisify } from 'util'
import fs from 'fs'
import rimRafLib from 'rimraf'
import mkdirpLib from 'mkdirp'

export const rm = promisify(rimRafLib)
export const mkdirp = promisify(mkdirpLib)

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type FuncReturningPromise<TReturn> = (...args: any) => Promise<TReturn>

type FuncReturningPromiseOrUndefined<
  TReturn, TFunc extends FuncReturningPromise<TReturn>
  > = (
    ...args: Parameters<TFunc>
  ) => Promise<TReturn | undefined>

export const notFoundAsUndefined = <TReturn, TFunc extends FuncReturningPromise<TReturn>>(
  f: TFunc,
): FuncReturningPromiseOrUndefined<TReturn, TFunc> => async (
    ...args: Parameters<TFunc>
  ): Promise<TReturn | undefined> => {
    try {
      return await f.call(null, ...args)
    } catch (err) {
      if (err.code === 'ENOENT') {
        return undefined
      }
      throw err
    }
  }

const statP = promisify(fs.stat)

export type Stats = fs.Stats
export const stat = (filename: string): Promise<fs.Stats> => statP(filename)

stat.notFoundAsUndefined = notFoundAsUndefined<fs.Stats, FuncReturningPromise<fs.Stats>>(stat)

export const exists = async (
  filename: string
): Promise<boolean> => (await stat.notFoundAsUndefined(filename)) !== undefined

export const readTextFile = (
  filename: string,
): Promise<string> => fs.promises.readFile(filename, { encoding: 'utf8' })

readTextFile.notFoundAsUndefined = notFoundAsUndefined<string, FuncReturningPromise<string>>(
  readTextFile
)

export const readFile = (filename: string): Promise<Buffer> => fs.promises.readFile(filename)

readFile.notFoundAsUndefined = notFoundAsUndefined<Buffer, FuncReturningPromise<Buffer>>(readFile)

export const writeTextFile = (
  filename: string,
  contents: string,
): Promise<void> => fs.promises.writeFile(filename, contents)

export const appendTextFile = (
  filename: string,
  contents: string,
): Promise<void> => fs.promises.writeFile(filename, contents, { flag: 'a' })

export const copyFile = (
  sourcePath: string,
  destPath: string,
): Promise<void> => fs.promises.copyFile(sourcePath, destPath)
