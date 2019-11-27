import path from 'path'
import { parseAsync } from 'json2csv'
import fs from 'fs'
import csv from 'csv-parser'
import { Value } from 'adapter-api'
import { mkdirp, writeFile, appendTextFile } from '../file'

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
  const formatHeader = (csvContent: string): string => {
    const rows = csvContent.split('\n')
    rows[0] = rows[0] && rows[0].replace(/"/g, '')
    return rows.join('\n')
  }

  await mkdirp(path.dirname(outputPath))
  let csvString: string
  if (!append) { // If this is the first chunk, create the headers
    csvString = `${await parseAsync(objects)}\n`
    await writeFile(outputPath, formatHeader(csvString))
  } else { // Otherwise do not create the headers as we only append data
    csvString = `${await parseAsync(objects, { header: false })}\n`
    await appendTextFile(outputPath, csvString)
  }
}

export const readCsvFromStream = (
  inputPath: string
): AsyncIterable<Value> => fs.createReadStream(inputPath).pipe(csv())
