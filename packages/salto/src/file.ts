import { promisify } from 'util'
import fs from 'fs'

const catchNoEnt = async <TReturn>(
  p: Promise<TReturn>
): Promise<TReturn | undefined> => p.catch(err => {
  if (err.code === 'ENOENT') {
    return undefined
  }
  throw err
})

const statP = promisify(fs.stat)

export const stat = (
  pathLike: string
): Promise<fs.Stats | undefined> => catchNoEnt(statP(pathLike))

export const readFile = (
  filename: string,
): Promise<string | undefined> => catchNoEnt(fs.promises.readFile(filename, { encoding: 'utf8' }))
