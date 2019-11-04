import { promises as fsp } from 'fs'
import { promisify } from 'util'
import path from 'path'
import mkdirpLib from 'mkdirp'
import { parseAsync } from 'json2csv'
import csvtojson from 'csvtojson'
import { Value } from 'adapter-api'

const mkdirp = promisify(mkdirpLib)

/**
 * Write objects to CSV file
 * @param objects The objects to write to the CSV
 * @param outputPath The path to the file
 * @param append append to csv file or treat this as the first set of objects
 */
export const dumpCsv = async (
  objects: object[],
  outputPath: string,
  append: boolean): Promise<void> => {
  // This method removes the commas from the header
  const formatHeader = (csvContent: string): string | undefined => {
    const rows = csvContent.split('\n')
    rows[0] = rows[0] && rows[0].replace(/"/g, '')
    return rows.join('\n')
  }

  await mkdirp(path.dirname(outputPath))
  let csvString: string
  if (!append) { // If this is the first chunk, create the headers
    csvString = `${await parseAsync(objects)}\n`
    await fsp.writeFile(outputPath, formatHeader(csvString))
  } else { // Otherwise do not create the headers as we only append data
    csvString = `${await parseAsync(objects, { header: false })}\n`
    await fsp.writeFile(outputPath, csvString, { flag: 'a' })
  }
}

export const readCsv = async (inputPath: string): Promise<Value[]> => (
  csvtojson().fromFile(inputPath)
)
