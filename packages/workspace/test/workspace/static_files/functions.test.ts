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

import { parser } from '@salto-io/parser'
import { getStaticFilesFunctions } from '../../../src/workspace/static_files/functions'
import { StaticFilesSource } from '../../../src/workspace/static_files'
import { mockStaticFilesSource } from '../../utils'
import { MissingStaticFile } from '../../../src/workspace/static_files/common'

describe('Functions', () => {
  let functions: parser.Functions
  let mockedStaticFilesSource: StaticFilesSource
  beforeEach(() => {
    mockedStaticFilesSource = mockStaticFilesSource()
    functions = getStaticFilesFunctions(mockedStaticFilesSource)
  })
  it('should have a file function', () => expect(functions).toHaveProperty('file'))
  it('should identify static file values', () =>
    expect(
      functions.file.isSerializedAsFunction(new StaticFile({ filepath: 'aa', hash: 'hash', encoding: 'binary' })),
    ).toBeTruthy())
  it('should identify invalid static file values', () =>
    expect(functions.file.isSerializedAsFunction(new MissingStaticFile('aa'))).toBeTruthy())
  it('should not identify for other values', () =>
    expect(functions.file.isSerializedAsFunction('a' as Value)).toBeFalsy())
  it('should convert valid function expression to valid static metadata', async () => {
    await functions.file.parse(['aa', 'utf-8'])
    expect(mockedStaticFilesSource.getStaticFile).toHaveBeenCalledTimes(1)
    expect(mockedStaticFilesSource.getStaticFile).toHaveBeenCalledWith({
      filepath: 'aa',
      encoding: 'utf-8',
      isTemplate: false,
    })
  })
  it('should convert valid function expression to valid static metadata when encoding is template', async () => {
    await functions.file.parse(['aa', 'template'])
    expect(mockedStaticFilesSource.getStaticFile).toHaveBeenCalledTimes(1)
    expect(mockedStaticFilesSource.getStaticFile).toHaveBeenCalledWith({
      filepath: 'aa',
      encoding: 'utf8',
      isTemplate: true,
    })
  })
  it('should persist when dumping static file with no content', async () => {
    const dumped = await functions.file.dump(
      new StaticFile({
        filepath: 'filepath',
        hash: 'hash',
      }),
    )
    expect(dumped).toHaveProperty('funcName', 'file')
    expect(dumped).toHaveProperty('parameters', ['filepath'])
    expect(mockedStaticFilesSource.persistStaticFile).toHaveBeenCalledTimes(1)
  })
  it('should persist when dumping static file with content', async () => {
    const dumped = await functions.file.dump(
      new StaticFile({
        filepath: 'filepath',
        content: Buffer.from('ZOMG'),
      }),
    )
    expect(dumped).toHaveProperty('funcName', 'file')
    expect(dumped).toHaveProperty('parameters', ['filepath'])
    expect(mockedStaticFilesSource.persistStaticFile).toHaveBeenCalledTimes(1)
  })
  it('should persist when dumping static file with isTemplate true', async () => {
    const dumped = await functions.file.dump(
      new StaticFile({
        filepath: 'filepath',
        content: Buffer.from('ZOMG'),
        isTemplate: true,
      }),
    )
    expect(dumped).toHaveProperty('funcName', 'file')
    expect(dumped).toHaveProperty('parameters', ['filepath', 'template'])
    expect(mockedStaticFilesSource.persistStaticFile).toHaveBeenCalledTimes(1)
  })
  it('should not persist when dumping invalid static file', async () => {
    const dumped = await functions.file.dump(new MissingStaticFile('filepath'))
    expect(dumped).toHaveProperty('funcName', 'file')
    expect(dumped).toHaveProperty('parameters', ['filepath'])
    expect(mockedStaticFilesSource.persistStaticFile).toHaveBeenCalledTimes(0)
  })
})
