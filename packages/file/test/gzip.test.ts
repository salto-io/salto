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
import fs from 'fs'
import tmp from 'tmp-promise'
import pako from 'pako'
import { gzip as zlibGzip } from 'zlib'
import { promisify } from 'util'
import { Readable } from 'stream'
import getStream from 'get-stream'
import * as file from '../src/file'
import * as gzip from '../src/gzip'

describe('gzip', () => {
  const expectRejectWithErrnoException = async <TResult>(
    p: () => Promise<TResult>
  ): Promise<void> => {
    let hadError = false
    try {
      await p()
    } catch (err) {
      expect(err.code).toBe('ENOENT')
      hadError = true
    }
    expect(hadError).toBeTruthy()
  }
  const expectRejectWithIncorrectHeaderException = async <TResult>(
    p: () => Promise<TResult>
  ): Promise<void> => {
    let hadError = false
    try {
      await p()
    } catch (err) {
      expect(err.code).toBe('Z_DATA_ERROR')
      expect(err.message).toBe('incorrect header check')
      hadError = true
    }
    expect(hadError).toBeTruthy()
  }

  describe('createGZipReadStream', () => {
    const source = __filename
    let destTmp: tmp.FileResult
    let dest: string

    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', async () => {
        await expectRejectWithErrnoException(() => getStream(gzip.createGZipReadStream('nosuchfile')))
      })
    })

    describe('when the zip file exists', () => {
      const content = 'hello world'
      beforeEach(async () => {
        destTmp = await tmp.file()
        dest = destTmp.path
        await file.writeFile(dest, await promisify(zlibGzip)((content)))
      })

      afterEach(async () => {
        await destTmp.cleanup()
      })

      describe('when all is well with the file', () => {
        it('should return its contents', async () => {
          expect(await file.exists(dest)).toBeTruthy()
          const r = await getStream(gzip.createGZipReadStream(dest))
          expect(content).toEqual(r)
        })
      })
    })

    describe('when the file exists, but is not a zip file', () => {
      beforeEach(async () => {
        destTmp = await tmp.file()
        dest = destTmp.path
        await file.copyFile(source, dest)
      })

      afterEach(async () => {
        await destTmp.cleanup()
      })

      it('should throw error', async () => {
        await expectRejectWithIncorrectHeaderException(() => getStream(gzip.createGZipReadStream(dest)))
      })
    })
  })

  describe('isOldFormatStateZipFile', () => {
    const source = __filename
    let destTmp: tmp.FileResult
    let dest: string

    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', async () => {
        await expectRejectWithErrnoException(() => gzip.isOldFormatStateZipFile('nosuchfile'))
      })
    })

    describe('when reading a valid old-format gzip', () => {
      const content = 'hello world'
      beforeEach(async () => {
        destTmp = await tmp.file()
        dest = destTmp.path
        // generate in the old way using pako
        await file.writeFile(dest, pako.gzip(content, { to: 'string' }))
      })

      afterEach(async () => {
        await destTmp.cleanup()
      })

      it('should return true', async () => {
        expect(await file.exists(dest)).toBeTruthy()
        expect(await gzip.isOldFormatStateZipFile(dest)).toEqual(true)
      })
    })

    describe('when reading a valid new-format gzip', () => {
      const content = 'hello world'
      beforeEach(async () => {
        destTmp = await tmp.file()
        dest = destTmp.path
        await file.writeFile(dest, await getStream(gzip.createGZipWriteStream(Readable.from(content))))
      })

      afterEach(async () => {
        await destTmp.cleanup()
      })

      it('should return false', async () => {
        expect(await file.exists(dest)).toBeTruthy()
        expect(await gzip.isOldFormatStateZipFile(dest)).toEqual(false)
      })
    })

    describe('when the file exists, but is not a zip file', () => {
      beforeEach(async () => {
        destTmp = await tmp.file()
        dest = destTmp.path
        await file.copyFile(source, dest)
      })

      afterEach(async () => {
        await destTmp.cleanup()
      })

      it('should return false', async () => {
        expect(await gzip.isOldFormatStateZipFile(dest)).toEqual(false)
      })
    })
  })

  describe('readOldFormatGZipFile', () => {
    const source = __filename
    let destTmp: tmp.FileResult
    let dest: string

    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', async () => {
        await expectRejectWithErrnoException(() => gzip.readOldFormatGZipFile('nosuchfile'))
      })
    })

    describe('when the zip file exists', () => {
      const content = 'hello world'
      beforeEach(async () => {
        destTmp = await tmp.file()
        dest = destTmp.path
        // generate in the old way using pako
        await file.writeFile(dest, pako.gzip(content, { to: 'string' }))
      })

      afterEach(async () => {
        await destTmp.cleanup()
      })

      describe('when all is well with the file', () => {
        it('should return its contents', async () => {
          expect(await file.exists(dest)).toBeTruthy()
          const r = await gzip.readOldFormatGZipFile(dest)
          expect(content).toEqual(r)
        })
      })
    })

    describe('when the file exists, but is not a zip file', () => {
      beforeEach(async () => {
        destTmp = await tmp.file()
        dest = destTmp.path
        await file.copyFile(source, dest)
      })

      afterEach(async () => {
        await destTmp.cleanup()
      })

      it('should throw error', async () => {
        expect(await gzip.readOldFormatGZipFile(dest)).toBeUndefined()
      })
    })
  })

  describe('readTextFileSync', () => {
    describe('when the file does not exist', () => {
      it('should throw an error', () => {
        expect(() => file.readTextFileSync('nosuchfile')).toThrow()
      })
    })

    describe('when the file exists', () => {
      it('should return its contents', () => {
        const r = file.readTextFileSync(__filename)
        expect(r).toEqual(fs.readFileSync(__filename, { encoding: 'utf8' }))
      })
    })
  })

  describe('writeFile', () => {
    const source = __filename
    let destTmp: tmp.FileResult
    let dest: string

    beforeEach(async () => {
      destTmp = await tmp.file()
      dest = destTmp.path
      await file.copyFile(source, dest)
    })

    afterEach(async () => {
      await destTmp.cleanup()
    })

    const expectedContents = 'a'

    describe('when given a string', () => {
      describe('when the file exists', () => {
        beforeEach(async () => {
          expect(await file.exists(dest)).toBeTruthy()
          await file.writeFile(dest, expectedContents)
        })

        it('overwrites its contents', async () => {
          const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
          expect(contents).toEqual(expectedContents)
        })
      })

      describe('when the file does not exist', () => {
        beforeEach(async () => {
          await file.rm(dest)
          expect(await file.exists(dest)).toBeFalsy()
          await file.writeFile(dest, expectedContents)
        })

        it('writes the contents to the file', async () => {
          const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
          expect(contents).toEqual(expectedContents)
        })
      })
    })

    describe('when given a buffer', () => {
      describe('when the file exists', () => {
        beforeEach(async () => {
          expect(await file.exists(dest)).toBeTruthy()
          await file.writeFile(dest, Buffer.from(expectedContents, 'utf8'))
        })

        it('overwrites its contents', async () => {
          const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
          expect(contents).toEqual(expectedContents)
        })
      })

      describe('when the file does not exist', () => {
        beforeEach(async () => {
          await file.rm(dest)
          expect(await file.exists(dest)).toBeFalsy()
          await file.writeFile(dest, Buffer.from(expectedContents, 'utf8'))
        })

        it('writes the contents to the file', async () => {
          const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
          expect(contents).toEqual(expectedContents)
        })
      })
    })
  })

  describe('createGZipWriteStream', () => {
    let destTmp: tmp.FileResult
    let dest: string

    beforeEach(async () => {
      destTmp = await tmp.file()
      dest = destTmp.path
      await file.copyFile(__filename, dest)
    })

    afterEach(async () => {
      await destTmp.cleanup()
    })

    describe('when writing to file and reading as zip', () => {
      const contents = 'arbitraryText'
      beforeEach(async () => {
        const data = await getStream.buffer(gzip.createGZipWriteStream(Readable.from(contents)))
        fs.writeFileSync(dest, data)
      })

      it('can be read as zip file', async () => {
        expect(contents).toEqual(await getStream(gzip.createGZipReadStream(dest)))
      })
    })
  })
})
