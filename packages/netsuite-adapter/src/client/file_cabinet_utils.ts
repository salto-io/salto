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
import _ from 'lodash'
import osPath from 'path'
import { FILE_CABINET_PATH_SEPARATOR as sep } from '../constants'

type FileToSize = Record<string, number>

type FolderSize = {
  path: string
  size: number
  folders: FolderSize[]
}

type FolderSizeMap = Record<string, FolderSize>
const BYTES_IN_GB = 1024 ** 3

export const excludeLargeFolders = (
  files: FileToSize,
  maxFileCabinetSizeInGB: number
): { listedPaths: string[]; largeFolderError: string[] } => {
  const createFlatFolderSizes = (fileSizes: FileToSize): FolderSizeMap => {
    const flatFolderSizes: FolderSizeMap = {}
    Object.entries(fileSizes).forEach(([path, size]) => {
      const pathParts = path.startsWith(sep)
        ? osPath.dirname(path).split(sep)
        : osPath.dirname(`${sep}${path}`).split(sep)
      pathParts.reduce((currentPath, nextFolder) => {
        const nextPath = osPath.join(currentPath, nextFolder)
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
      if (folderName.indexOf(sep) === -1) { // Top level folder
        folderGraph.push(flatFolderSizes[folderName])
      } else { // Sub folder
        const parentFolder = osPath.dirname(folderName)
        flatFolderSizes[parentFolder].folders.push(flatFolderSizes[folderName])
      }
    })
    return folderGraph
  }

  const folderSizes = createFolderHierarchy(createFlatFolderSizes(files))
  const maxSizeInBytes = BYTES_IN_GB * maxFileCabinetSizeInGB
  const overflowSize = folderSizes.reduce((acc, folder) => acc + folder.size, 0) - maxSizeInBytes

  const filterSingleFolder = (largestFolder: FolderSize): string[] => {
    const nextLargeFolder = largestFolder.folders.find(folderSize => folderSize.size > overflowSize)
    if (!nextLargeFolder) {
      return [largestFolder.path]
    }
    return filterSingleFolder(nextLargeFolder)
  }

  const filterMultipleFolders = (): string[] => {
    const sortedSizes = _.orderBy(folderSizes, 'size', 'desc')
    const selectedFolders = [] as string[]
    sortedSizes.reduce((selectedSize, folderSize) => {
      if (selectedSize < overflowSize) {
        selectedFolders.push(folderSize.path)
        return selectedSize + folderSize.size
      }
      return selectedSize
    }, 0)
    return selectedFolders
  }

  if (overflowSize <= 0) {
    return { listedPaths: Object.keys(files), largeFolderError: [] }
  }

  const largeTopLevelFolder = folderSizes.find(folderSize => folderSize.size > overflowSize)
  const foldersToExclude = largeTopLevelFolder
    ? filterSingleFolder(largeTopLevelFolder)
    : filterMultipleFolders()
  const listedPaths = Object.keys(files).filter(filePath => !foldersToExclude.some(
    folder => filePath.startsWith(`${folder}${sep}`)
      || filePath.startsWith(`${sep}${folder}${sep}`)
  ))
  return { listedPaths, largeFolderError: foldersToExclude }
}
