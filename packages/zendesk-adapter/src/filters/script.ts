/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
// import fs from 'fs'
// import csv from 'csv-parser'

// interface CSVRow {
//   [key: string]: string
// }

// const extractDistinctOperationIds = (filePath: string, columnIndex: number): void => {
//   const distinctValues = new Set<string>()

//   fs.createReadStream(filePath)
//     .pipe(csv())
//     .on('data', (row: CSVRow) => {
//       const values = Object.values(row)
//       if (values[columnIndex]) {
//         distinctValues.add(values[columnIndex].toString().replace(/"/g, '').trim())
//       }
//     })
//   // .on('end', () => {
//   //   console.log('Distinct Values:', Array.from(distinctValues)) // Print distinct values here
//   // })
//   // .on('error', err => {
//   //   console.error('Error reading the file:', err)
//   // })
// }

// const extractFailedRefTriggers = async (filePath: string, columnIndex: number): Promise<Set<string>> =>
//   new Promise((resolve, reject) => {
//     const extractedSubstrings = new Set<string>()

//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on('data', (row: CSVRow) => {
//         const values = Object.values(row)
//         const columnValue = values[columnIndex]
//         if (columnValue) {
//           const pathValue = columnValue.split('path ')[1]
//           // Regex to extract the substring between the second dot after 'instance' and the next dot
//           const match = pathValue.match(/trigger\.instance\.([^.]+)\./)
//           if (match && match[1]) {
//             extractedSubstrings.add(match[1].trim())
//           }
//         }
//       })
//       .on('end', () => {
//         resolve(extractedSubstrings)
//       })
//       .on('error', err => {
//         reject(err)
//       })
//   })

// const extractFailedToDeploy = async (filePath: string, columnIndex: number): Promise<Set<string>> =>
//   new Promise((resolve, reject) => {
//     const failedToDeploy = new Set<string>()

//     fs.createReadStream(filePath)
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on('data', (row: CSVRow) => {
//         const values = Object.values(row)
//         const columnValue = values[columnIndex]
//         if (columnValue) {
//           const match = columnValue.match(/trigger\.instance\.([^ ]+) /)
//           if (match && match[1]) {
//             failedToDeploy.add(match[1].trim())
//           }
//         }
//       })
//       .on('end', () => {
//         resolve(failedToDeploy)
//       })
//       .on('error', err => {
//         reject(err)
//       })
//   })

// const groupBySecondColumn = async (filePath: string): Promise<Record<string, string[]>> =>
//   new Promise((resolve, reject) => {
//     const groupedData: Record<string, string[]> = {}

//     fs.createReadStream(filePath)
//       .pipe(csv({ headers: false }))
//       .on('data', (row: CSVRow) => {
//         const firstValue = row[0] // First column (string part)
//         const secondValue = row[1] // Second column (number part)

//         if (!groupedData[secondValue]) {
//           groupedData[secondValue] = []
//         }
//         groupedData[secondValue].push(firstValue.replace(/zendesk.trigger.instance./, ''))
//       })
//       .on('end', () => {
//         resolve(groupedData) // Resolve the grouped data
//       })
//       .on('error', err => {
//         reject(err) // Reject the promise on error
//       })
//   })

// interface DBRow {
//   orgname: string
//   envname: string
//   envid: string
//   opid: string
//   id: string
// }

// const parseCSVAsObject = async (filePath: string): Promise<DBRow[]> =>
//   new Promise((resolve, reject) => {
//     const rows: CSVRow[] = []

//     fs.createReadStream(filePath)
//       .pipe(csv()) // Automatically uses the first row as headers
//       .on('data', (row: CSVRow) => {
//         rows.push(row) // Push each parsed row into the array
//       })
//       .on('end', () => {
//         resolve(rows as unknown as DBRow[]) // Resolve the array of rows
//       })
//       .on('error', err => {
//         reject(err) // Reject the promise if an error occurs
//       })
//   })

// const intersectElemIds = (groupedData: Record<string, string[]>, elemIdSet: Set<string>): Record<string, string[]> => {
//   const intersectionResult: Record<string, string[]> = {}

//   for (const [operationId, elemIds] of Object.entries(groupedData)) {
//     // console.log('Elem ids:', elemIds)
//     const intersectedElemIds = elemIds.filter(elemId => elemIdSet.has(elemId))
//     if (intersectedElemIds.length > 0) {
//       intersectionResult[operationId] = intersectedElemIds
//     }
//   }

//   return intersectionResult
// }

// const removeElemIds = (groupedData: Record<string, string[]>, elemIdSet: Set<string>): Record<string, string[]> => {
//   const removedElemIds: Record<string, string[]> = {}

//   for (const [operationId, elemIds] of Object.entries(groupedData)) {
//     const removed = elemIds.filter(elemId => !elemIdSet.has(elemId))
//     if (removed.length > 0) {
//       removedElemIds[operationId] = removed
//     }
//   }

//   return removedElemIds
// }

// const groupByEnvIdWithAggregation = (
//   data: {
//     orgname: string
//     envname: string
//     envid: string
//     opid: string
//     id: string
//   }[],
//   elemIdMap: Record<string, string[]>,
// ): Record<string, { orgname: string; envname: string; envid: string; opids: string[]; elemIds: string[] }> => {
//   const groupedData: Record<
//     string,
//     { orgname: string; envname: string; envid: string; opids: string[]; elemIds: string[] }
//   > = {}

//   for (const entry of data) {
//     const { envid, id, opid, ...rest } = entry

//     // Get the elemIds for the current `id`
//     const elemIds = elemIdMap[id] || []

//     if (!groupedData[envid]) {
//       // Initialize if `envid` doesn't exist in groupedData
//       groupedData[envid] = { ...rest, envid, opids: [opid], elemIds: [...elemIds] }
//     } else {
//       // Merge: Combine elemIds and opids while ensuring uniqueness
//       groupedData[envid].opids = Array.from(new Set([...groupedData[envid].opids, opid]))
//       groupedData[envid].elemIds = Array.from(new Set([...groupedData[envid].elemIds, ...elemIds]))
//     }
//   }

//   return groupedData
// }

// const main = async (): Promise<unknown> => {
//   const failedReferencePath = '/Users/adamfineberg/Downloads/extract-2025-01-24T19_05_31.634Z.csv'
//   const operationIdIndex = 4 // 5th column (0-based index)
//   const messageIndex = 5 // 6th column (0-based index)
//   extractDistinctOperationIds(failedReferencePath, operationIdIndex)
//   const failedRefTriggers = await extractFailedRefTriggers(failedReferencePath, messageIndex)
//   // console.log('Failed ref triggers:', failedRefTriggers.size)

//   const failedToDeployPath = '/Users/adamfineberg/Downloads/extract-2025-01-24T19_07_58.162Z.csv'

//   const failedMessageIndex = 3 // 4th column (0-based index)
//   const failedToDeployElemIds = await extractFailedToDeploy(failedToDeployPath, failedMessageIndex)
//   // console.log('Failed to deploy:', failedToDeployElemIds.size)

//   const dbOpChangesPath = '/Users/adamfineberg/Downloads/opchanges.csv'
//   const groupedData = await groupBySecondColumn(dbOpChangesPath)

//   const intersectedElemIds = intersectElemIds(groupedData, failedRefTriggers)

//   // console.log('Intersected elem ids:', Object.keys(intersectedElemIds).length)
//   const removedElemIds = removeElemIds(intersectedElemIds, failedToDeployElemIds)
//   // console.log('Removed elem ids:', Object.keys(removedElemIds))

//   const dbDataPath = '/Users/adamfineberg/Downloads/dbData.csv'
//   const dbData = await parseCSVAsObject(dbDataPath)
//   // console.log('DB Data:', dbData)

//   const groupedDataWithAggregation = groupByEnvIdWithAggregation(dbData, removedElemIds)
//   // console.log('Grouped data with aggregation:', Object.values(groupedDataWithAggregation))
//   return groupedDataWithAggregation
// }

// // eslint-disable-next-line no-void
// void main()
