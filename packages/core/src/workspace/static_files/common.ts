/*
*                      Copyright 2020 Salto Labs Ltd.
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

export const STATIC_RESOURCES_FOLDER = 'static-resources'

export type StaticFilesSource = {
  getStaticFile: (filepath: string) =>
    Promise<StaticFile | InvalidStaticFile>
  getContent: (filepath: string) => Promise<Buffer>
  persistStaticFile: (staticFile: StaticFile) => Promise<void>
  flush: () => Promise<void>
  clear: () => Promise<void>
  rename: (name: string) => Promise<void>
  clone: () => StaticFilesSource
}

export class InvalidStaticFile extends StaticFile {
  constructor(
    public readonly filepath: string
  ) {
    super(filepath, 'missing-file')
  }
}

export const isInvalidStaticFile = (val: Value): boolean => val instanceof InvalidStaticFile
