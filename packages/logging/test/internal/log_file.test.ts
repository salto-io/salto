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
import fs, { PathLike } from 'fs'
import path from 'path'
import { validateLogFile } from '../../src/internal/log-file'

describe('validateLogFile', () => {
  const WRITE_DIR = '/home/user/.salto'
  const READ_ONLY_DIR = '/'
  const MISSING_DIR = '/missing'
  const WRITE_FILE = 'log.txt'
  const READ_ONLY_FILE = 'read_only.txt'
  const MISSING_FILE = path.join('missing.txt')

  const mockAccess = (filename: PathLike, _mode?: number): boolean => {
    const filenameStr = filename.toString()
    if (filenameStr.toString() === READ_ONLY_DIR || path.basename(filenameStr) === READ_ONLY_FILE) {
      throw Error('OY VEY!')
    }
    return true
  }

  const accessSpy = jest.spyOn(fs, 'accessSync')

  const mockExists = (filename: PathLike, _mode?: number): boolean => {
    const filenameStr = filename.toString()
    if (path.basename(filenameStr.toString()) === MISSING_FILE || filenameStr === MISSING_DIR) {
      return false
    }
    return true
  }

  const existsSpy = jest.spyOn(fs, 'existsSync')

  beforeAll(() => {
    accessSpy.mockImplementation(mockAccess)
    existsSpy.mockImplementation(mockExists)
  })

  afterAll(() => {
    accessSpy.mockRestore()
    existsSpy.mockRestore()
  })

  it('should return the filename if the file exists in writeable and dir is writeable', () => {
    const filename = path.join(WRITE_DIR, WRITE_FILE)
    expect(validateLogFile(filename)).toEqual(filename)
  })

  it('should return the filename if the file is missing and dir is writeable', () => {
    const filename = path.join(WRITE_DIR, MISSING_FILE)
    expect(validateLogFile(filename)).toEqual(filename)
  })

  it('should return the filename if the file is writeable and dir is not writeable', () => {
    const filename = path.join(READ_ONLY_DIR, WRITE_FILE)
    expect(validateLogFile(filename)).toEqual(filename)
  })

  it('should return undefined if the file is not writeable and dir is not writeable', () => {
    const filename = path.join(READ_ONLY_DIR, READ_ONLY_FILE)
    expect(validateLogFile(filename)).toBeUndefined()
  })

  it('should return undefined if the file is missing and dir is not writeable', () => {
    const filename = path.join(READ_ONLY_DIR, MISSING_FILE)
    expect(validateLogFile(filename)).toBeUndefined()
  })

  it('should return undefined if the file is missing and dir is missing', () => {
    const filename = path.join(MISSING_DIR, MISSING_FILE)
    expect(validateLogFile(filename)).toBeUndefined()
  })
})
