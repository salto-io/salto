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
import { orderBy } from 'lodash'
import osPath from 'path'
import { FILE_CABINET_PATH_SEPARATOR } from '../constants'

type FileToSize = { [path: string]: number }

type FolderSize = {
    path: string
    size: number
    folders: FolderSize[]
}

type FolderSizeMap = { [path: string]: FolderSize }

export const excludeLargeFolders = (files: FileToSize, maxFileCabinetSize: number):
    { listedPaths: string[]; largeFolderError: string[] } => {
  const folderSizes = (): FolderSize[] => {
    const statFolders = (fileSizes: FileToSize): FolderSize[] => {
      const createFlatFolderSizes = (): FolderSizeMap => {
        const flatFolderSizes = {} as FolderSizeMap
        Object.keys(fileSizes).forEach((path: string) => {
          const pathParts = path.startsWith(osPath.sep)
            ? osPath.dirname(path).split(osPath.sep)
            : osPath.dirname(`${osPath.sep}${path}`).split(osPath.sep)
          pathParts.reduce((currentPath, nextFolder) => {
            const nextPath = osPath.join(currentPath, nextFolder)
            if (nextPath in flatFolderSizes) {
              flatFolderSizes[nextPath].size += fileSizes[path]
            } else {
              flatFolderSizes[nextPath] = {
                path: nextPath,
                size: fileSizes[path],
                folders: [],
              }
            }
            return nextPath
          })
        })
        return flatFolderSizes
      }
      const createFolderHierarchy = (flatFolderSizes: FolderSizeMap): FolderSize[] => {
        const folderGraph = [] as FolderSize[]
        Object.keys(flatFolderSizes).forEach(folderName => {
          if (folderName.indexOf(osPath.sep) === -1) { // Top level folder
            folderGraph.push(flatFolderSizes[folderName])
          } else { // Sub folder
            const parentFolder = osPath.dirname(folderName)
            flatFolderSizes[parentFolder].folders.push(flatFolderSizes[folderName])
          }
        })
        return folderGraph
      }

      return createFolderHierarchy(createFlatFolderSizes())
    }

    return statFolders(files)
  }

  const sizes = folderSizes()
  const maxSizeInBytes = (1024 ** 3) * maxFileCabinetSize
  const overflowSize = sizes.reduce((acc, folder) => acc + folder.size, 0) - maxSizeInBytes

  const filterSingleFolder = (): string[] => {
    let lastLargeFolder = sizes.find(folderSize => folderSize.size > overflowSize) as FolderSize
    let noLargeSubFolders = false
    while (!noLargeSubFolders) {
      const nextLargeFolder = lastLargeFolder.folders.find(folderSize => folderSize.size > overflowSize)
      if (nextLargeFolder) {
        lastLargeFolder = nextLargeFolder
      } else {
        noLargeSubFolders = true
      }
    }

    return [lastLargeFolder.path]
  }

  const filterMultipleFolders = (): string[] => {
    const sortedSizes = orderBy(sizes, 'size', 'desc')
    let selectedSize = 0
    const selectedFolders = [] as string[]
    while (selectedSize <= overflowSize) {
      const folderSize = sortedSizes.shift()
      if (!folderSize) {
        break
      }
      selectedFolders.push(folderSize.path)
      selectedSize += folderSize.size
    }

    return selectedFolders
  }

  if (overflowSize <= 0) {
    return { listedPaths: Object.keys(files), largeFolderError: [] }
  }

  const foldersToExclude = sizes.some(folderSize => folderSize.size > overflowSize)
    ? filterSingleFolder()
    : filterMultipleFolders()
  const listedPaths = Object.keys(files).filter(filePath => !foldersToExclude.some(
    folder => filePath.startsWith(folder)
      || filePath.startsWith(`${FILE_CABINET_PATH_SEPARATOR}${folder}`)
  ))
  return { listedPaths, largeFolderError: foldersToExclude }
}
