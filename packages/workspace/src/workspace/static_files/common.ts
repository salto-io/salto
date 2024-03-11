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
import { StaticFile, Value } from '@salto-io/adapter-api'
import { DirectoryStore } from '../dir_store'

export abstract class InvalidStaticFile {
  constructor(
    public readonly filepath: string,
    public readonly message: string,
  ) {}
}

export type StaticFilesSource = {
  // Load is optional for backwards compatibility
  load?(): Promise<string[]>
  getStaticFile: (args: {
    filepath: string
    encoding: BufferEncoding
    hash?: string
    isTemplate?: boolean
  }) => Promise<StaticFile | InvalidStaticFile>
  getContent: (filepath: string) => Promise<Buffer>
  persistStaticFile: (staticFile: StaticFile) => Promise<void>
  flush: () => Promise<void>
  clear: () => Promise<void>
  rename: (name: string) => Promise<void>
  getTotalSize: () => Promise<number>
  clone: () => StaticFilesSource
  delete: (staticFile: StaticFile) => Promise<void>
  isPathIncluded: (path: string) => boolean
}

export class MissingStaticFile extends InvalidStaticFile {
  constructor(filepath: string) {
    super(filepath, `Missing static file: ${filepath}`)
  }
}

export class AccessDeniedStaticFile extends InvalidStaticFile {
  constructor(filepath: string) {
    super(filepath, `Unable to access static file: ${filepath}`)
  }
}

export const isInvalidStaticFile = (val: Value): val is InvalidStaticFile => val instanceof InvalidStaticFile

export type StateStaticFilesSource = Pick<
  StaticFilesSource,
  'getStaticFile' | 'persistStaticFile' | 'flush' | 'clear' | 'rename' | 'delete'
>

export type StateStaticFilesStore = Pick<DirectoryStore<Buffer>, 'get' | 'set' | 'list' | 'getFullPath' | 'flush'>
