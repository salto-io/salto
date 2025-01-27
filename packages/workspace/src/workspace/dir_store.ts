/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

export type FlushResult<T extends ContentType> = {
  updates: File<T>[]
  deletions: string[]
}

export type DirectoryStore<T extends ContentType> = {
  list(): Promise<string[]>
  get(filename: string, options?: GetFileOptions): Promise<File<T> | undefined>
  set(file: File<T>): Promise<void>
  delete(filename: string): Promise<void>
  clear(): Promise<void>
  rename(name: string): Promise<void>
  renameFile(name: string, newName: string): Promise<void>
  flush(): Promise<FlushResult<T> | void>
  mtimestamp(filename: string): Promise<number | undefined>
  getFiles(filenames: string[], options?: GetFileOptions): Promise<(File<T> | undefined)[]>
  getTotalSize(): Promise<number>
  clone(): DirectoryStore<T>
  isEmpty(): Promise<boolean>
  getFullPath(filename: string): string
  isPathIncluded(filePath: string): boolean
  exists: (filePath: string) => Promise<boolean>
}
