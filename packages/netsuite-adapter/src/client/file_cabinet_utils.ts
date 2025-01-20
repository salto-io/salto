/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { posix } from 'path'
import { strings } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ERROR_MESSAGES } from '@salto-io/adapter-utils'
import { InstanceElement, SaltoElementError, SaltoError } from '@salto-io/adapter-api'
import { FOLDER, PATH, FILE_CABINET_PATH_SEPARATOR as sep } from '../constants'
import { WARNING_MAX_FILE_CABINET_SIZE_IN_GB } from '../config/constants'
import { MaxFilesPerFileCabinetFolder } from '../config/types'

const log = logger(module)

export type FileSize = {
  path: string
  size: number
}

type FolderSize = {
  path: string
  size: number
  folders: FolderSize[]
}

type FolderSizeMap = Record<string, FolderSize>
const BYTES_IN_GB = 1024 ** 3

const folderSizeSum = (numbers: FolderSize[]): number => numbers.reduce((acc, folder) => acc + folder.size, 0)

const createFlatFolderSizes = (fileSizes: FileSize[]): FolderSizeMap => {
  const flatFolderSizes: FolderSizeMap = {}
  fileSizes.forEach(({ path, size }) => {
    posix
      .dirname(path)
      .split(sep)
      .reduce((currentPath, nextFolder) => {
        const nextPath = posix.join(currentPath, nextFolder)
        if (nextPath in flatFolderSizes) {
          flatFolderSizes[nextPath].size += size
        } else {
          flatFolderSizes[nextPath] = {
            path: nextPath,
            size,
            folders: [],
          }
        }
        return nextPath
      })
  })
  return flatFolderSizes
}

const createFolderHierarchy = (flatFolderSizes: FolderSizeMap): FolderSize[] => {
  const folderGraph: FolderSize[] = []
  Object.keys(flatFolderSizes).forEach(folderName => {
    if (folderName.indexOf(sep) === -1) {
      // Top level folder
      folderGraph.push(flatFolderSizes[folderName])
    } else {
      // Sub folder
      const parentFolder = posix.dirname(folderName)
      flatFolderSizes[parentFolder].folders.push(flatFolderSizes[folderName])
    }
  })
  return folderGraph
}

const filterSingleFolder = (largestFolder: FolderSize, overflowSize: number): FolderSize[] => {
  const nextLargeFolder = largestFolder.folders.find(folderSize => folderSize.size > overflowSize)
  if (!nextLargeFolder) {
    return [largestFolder]
  }
  return filterSingleFolder(nextLargeFolder, overflowSize)
}

const filterMultipleFolders = (folderSizes: FolderSize[], overflowSize: number): FolderSize[] => {
  const sortedSizes = _.orderBy(folderSizes, 'size', 'desc')
  const selectedFolders: FolderSize[] = []
  sortedSizes.reduce((selectedSize, folderSize) => {
    if (selectedSize < overflowSize) {
      selectedFolders.push(folderSize)
      return selectedSize + folderSize.size
    }
    return selectedSize
  }, 0)
  return selectedFolders
}

export const largeFoldersToExclude = (files: FileSize[], maxFileCabinetSizeInGB: number): string[] => {
  const folderSizes = createFolderHierarchy(createFlatFolderSizes(files))
  const maxSizeInBytes = BYTES_IN_GB * maxFileCabinetSizeInGB
  const totalFolderSize = folderSizeSum(folderSizes)
  const overflowSize = totalFolderSize - maxSizeInBytes

  if (overflowSize <= 0) {
    if (totalFolderSize > BYTES_IN_GB * WARNING_MAX_FILE_CABINET_SIZE_IN_GB) {
      log.info(
        `FileCabinet has exceeded the suggested size limit of ${WARNING_MAX_FILE_CABINET_SIZE_IN_GB} GB,` +
          ` its size is ${strings.humanFileSize(totalFolderSize)}.`,
      )
    }
    return []
  }

  const largeTopLevelFolder = folderSizes.find(folderSize => folderSize.size > overflowSize)
  const foldersToExclude = largeTopLevelFolder
    ? filterSingleFolder(largeTopLevelFolder, overflowSize)
    : filterMultipleFolders(folderSizes, overflowSize)

  log.warn(
    `FileCabinet has exceeded the defined size limit of ${maxFileCabinetSizeInGB} GB,` +
      ` its size is ${strings.humanFileSize(totalFolderSize)}.` +
      ` Excluding large folder(s) with total size of ${folderSizeSum(foldersToExclude)}` +
      ` and name(s): ${foldersToExclude.map(folder => folder.path).join(', ')}`,
  )
  return foldersToExclude.map(folder => `${sep}${folder.path}${sep}`)
}

const filterPathsInFoldersByFunc = <T>(
  pathObjects: T[],
  folders: string[],
  transformer: (pathObject: T) => string,
): T[] => pathObjects.filter(file => !folders.some(folder => transformer(file).startsWith(folder)))

export const filterFilesInFolders = (files: string[], folders: string[]): string[] =>
  filterPathsInFoldersByFunc(files, folders, file => file)

export const filterFilePathsInFolders = <T extends { path: string[] }>(files: T[], folders: string[]): T[] =>
  filterPathsInFoldersByFunc(files, folders, file => `${sep}${file.path.join(sep)}`)

export const filterFolderPathsInFolders = <T extends { path: string[] }>(files: T[], folders: string[]): T[] =>
  filterPathsInFoldersByFunc(files, folders, file => `${sep}${file.path.join(sep)}${sep}`)

export const createLargeFilesCountFolderFetchWarnings = (
  instances: InstanceElement[],
  largeFilesCountFolderWarnings: MaxFilesPerFileCabinetFolder[],
): (SaltoError | SaltoElementError)[] => {
  const folderInstances = _.keyBy(
    instances.filter(instance => instance.elemID.typeName === FOLDER),
    instance => instance.value[PATH] as string,
  )
  return largeFilesCountFolderWarnings.map(({ folderPath, limit }) => {
    const severity = 'Warning'
    const message = ERROR_MESSAGES.OTHER_ISSUES
    const detailedMessage =
      `The File Cabinet folder "${folderPath}" is close to exceed the limit of allowed amount of files in a folder, which is ${limit} files.` +
      ' The folder will be automatically excluded in case of reaching that limit.' +
      ' In order to keep managing this folder in Salto, add it to the `client.maxFilesPerFileCabinetFolder` config with a matching limit.' +
      ' To learn more visit https://github.com/salto-io/salto/blob/main/packages/netsuite-adapter/config_doc.md'

    const folderInstance = folderInstances[folderPath]
    if (folderInstance === undefined) {
      log.warn(
        'missing folder instance with path %s . returning LargeFilesCountFolderFetchWarning without instance elemID.',
        folderPath,
      )
      return { severity, message, detailedMessage }
    }
    return { severity, message, detailedMessage, elemID: folderInstance.elemID }
  })
}
