/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Values } from '@salto-io/adapter-api'
import { NetsuiteQueryParameters } from '../query'

export interface CustomizationInfo {
  typeName: string
  values: Values
}

export interface CustomTypeInfo extends CustomizationInfo {
  scriptId: string
}

export interface TemplateCustomTypeInfo extends CustomTypeInfo {
  fileExtension: string
  fileContent: Buffer
}

export interface FileCustomizationInfo extends CustomizationInfo {
  path: string[]
  fileContent: Buffer
}

export interface FolderCustomizationInfo extends CustomizationInfo {
  path: string[]
}

export type GetCustomObjectsResult = {
  elements: CustomTypeInfo[]
  failedToFetchAllAtOnce: boolean
  failedTypeToInstances: NetsuiteQueryParameters['types']
}

export type ImportFileCabinetResult = {
  elements: (FileCustomizationInfo | FolderCustomizationInfo)[]
  failedPaths: NetsuiteQueryParameters['filePaths']
}

export type ImportObjectsResult = {
  errorImports: unknown
  successfulImports: unknown
  failedImports: {
    customObject: {
      id: string
      type: string
      result: {
        code: 'FAILED'
        message: string
      }
    }
    referencedFileImportResult: unknown
  }[]
}
