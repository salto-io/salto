import * as asyncfile from 'async-file'
import path from 'path'
import { parseAsync } from 'json2csv'

/**
 * Write objects to CSV file
 * @param objects The objects to write to the CSV
 * @param outputPath The path to the file
 * @param append append to csv file or treat this as the first set of objects
 */
export const dumpCsv = async (
  objects: object[],
  outputPath: string,
  append = false): Promise<void> => {
  await asyncfile.mkdirp(path.dirname(outputPath))
  let csvString: string
  if (!append) { // If this is the first chunk, create the headers
    csvString = await parseAsync(objects)
    const rows = csvString.split('\n')
    let header = rows.shift()
    if (header) {
      header = header.replace(/"/g, '')
      rows.unshift(header)
      csvString = rows.join('\n')
    }
  } else { // Otherwise do not create the headers as we only append data
    csvString = await parseAsync(objects, { header: false })
  }
  await asyncfile.writeFile(outputPath, csvString)
}

export default dumpCsv
