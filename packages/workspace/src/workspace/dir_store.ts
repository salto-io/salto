/*
 *                      Copyright 2024 Salto Labs Ltd.
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
export type ContentType = string | Buffer

export type File<T extends ContentType> = {
  filename: string
  buffer: T
  timestamp?: number
}

export type GetFileOptions = {
  ignoreDeletionsCache?: boolean
}

export type DirectoryStore<T extends ContentType> = {
  list(): Promise<string[]>
  get(filename: string, options?: GetFileOptions): Promise<File<T> | undefined>
  set(file: File<T>): Promise<void>
  delete(filename: string): Promise<void>
  clear(): Promise<void>
  rename(name: string): Promise<void>
  renameFile(name: string, newName: string): Promise<void>
  flush(): Promise<void>
  mtimestamp(filename: string): Promise<number | undefined>
  getFiles(filenames: string[], options?: GetFileOptions): Promise<(File<T> | undefined)[]>
  getTotalSize(): Promise<number>
  clone(): DirectoryStore<T>
  isEmpty(): Promise<boolean>
  getFullPath(filename: string): string
  isPathIncluded(filePath: string): boolean
  exists: (filePath: string) => Promise<boolean>
}
