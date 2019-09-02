import * as fs from 'async-file'
import path from 'path'
import { parseAsync } from 'json2csv'

/**
 * Write objects to CSV to file
 * @param blueprint The blueprint to dump
 */
export const dumpCsv = async (objects: object[], outputPath: string): Promise<void> => {
  await fs.mkdirp(path.dirname(outputPath))
  let csvString = await parseAsync(objects)
  const rows = csvString.split('\n')
  let header = rows.shift()
  if (header) {
    header = header.replace(/"/g, '')
    rows.unshift(header)
    csvString = rows.join('\n')
  }
  await fs.writeFile(outputPath, csvString)
}

export default dumpCsv
