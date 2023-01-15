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
import path from 'path'
import { promisify } from 'util'
import tmp from 'tmp-promise'
import rimRafLib from 'rimraf'
import * as file from '../src/file'

const rimRaf = promisify(rimRafLib)

describe('file', () => {
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
  describe('stat', () => {
    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', async () => {
        await expectRejectWithErrnoException(() => file.stat('nosuchfile'))
      })
    })

    describe('when the file exists', () => {
      it('should return its stats', async () => {
        // can't compare all stats since aTime and aTimeMs might differ slightly
        const r = (await file.stat(__filename)).ctime
        expect(r).toEqual((await promisify(fs.stat)(__filename)).ctime)
      })
    })
  })

  describe('stat sync', () => {
    describe('when the file does not exist', () => {
      it('should throw an exception', () => {
        expect(() => file.statSync('nosuchfile')).toThrow()
      })
    })

    describe('when the file exists', () => {
      it('should return its stats', () => {
        // can't compare all stats since aTime and aTimeMs might differ slightly
        const r = (file.statSync(__filename)).ctime
        expect(r).toEqual((fs.statSync(__filename)).ctime)
      })
    })
  })

  describe('stat.notFoundAsUndefined', () => {
    describe('when the file does not exist', () => {
      it('should return undefined', async () => {
        const r = await file.stat.notFoundAsUndefined('nosuchfile')
        expect(r).toBeUndefined()
      })
    })

    describe('when the file exists', () => {
      it('should return its stats', async () => {
        const r = await file.stat.notFoundAsUndefined(__filename)
        expect(r).toEqual(await promisify(fs.stat)(__filename))
      })
    })

    describe('when there is another error', () => {
      const tooLongFilename = 'a'.repeat(1000).repeat(1000)
      it(
        'should reject with the error',
        () => expect(
          file.stat.notFoundAsUndefined(tooLongFilename),
        ).rejects.toThrow(/ENAMETOOLONG/),
      )
    })
  })

  describe('exists', () => {
    describe('when the file does not exist', () => {
      it('should return false', async () => {
        expect(await file.exists('nosuchfile')).toBe(false)
      })
    })

    describe('when the file exists', () => {
      it('should return true', async () => {
        expect(await file.exists(__filename)).toBe(true)
      })
    })
  })

  describe('exists sync', () => {
    describe('when the file does not exist', () => {
      it('should return false', () => {
        expect(file.existsSync('nosuchfile')).toBe(false)
      })
    })

    describe('when the file exists', () => {
      it('should return true', () => {
        expect(file.existsSync(__filename)).toBe(true)
      })
    })
  })

  describe('readFile', () => {
    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', async () => {
        await expectRejectWithErrnoException(() => file.readFile('nosuchfile'))
      })
    })

    describe('when the file exists', () => {
      it('should return its contents', async () => {
        const r = await file.readFile(__filename)
        expect(r).toEqual(await fs.promises.readFile(__filename))
      })
    })
  })

  describe('readTextFile', () => {
    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', async () => {
        await expectRejectWithErrnoException(() => file.readTextFile('nosuchfile'))
      })
    })

    describe('when the file exists', () => {
      it('should return its contents', async () => {
        const r = await file.readTextFile(__filename)
        expect(r).toEqual(await fs.promises.readFile(__filename, { encoding: 'utf8' }))
      })
    })
  })

  describe('appendTextFile', () => {
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

    describe('when the file exists', () => {
      beforeEach(async () => {
        expect(await file.exists(dest)).toBeTruthy()
        await file.appendTextFile(dest, 'a')
      })

      it('appends to it', async () => {
        const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
        const expectedContents = `${await fs.promises.readFile(source, { encoding: 'utf8' })}a`
        expect(contents).toEqual(expectedContents)
      })
    })

    describe('when the file does not exist', () => {
      beforeEach(async () => {
        await file.rm(dest)
        expect(await file.exists(dest)).toBeFalsy()
        await file.appendTextFile(dest, 'a')
      })

      it('writes the contents to the file', async () => {
        const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
        const expectedContents = 'a'
        expect(contents).toEqual(expectedContents)
      })
    })
  })

  describe('copyFile', () => {
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

    it('copies the file', async () => {
      expect(await file.readTextFile(dest)).toEqual(await file.readTextFile(source))
    })
  })

  describe('replaceContents', () => {
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

    describe('when interrupted while writing the new contents', () => {
      beforeEach(async () => {
        jest.spyOn(file, 'writeFile').mockImplementationOnce(async filename => {
          await fs.promises.writeFile(filename, 'corrupted')
          throw new Error('testing')
        })
        await expect(file.replaceContents(dest, 'aa')).rejects.toThrow('testing')
      })

      it('does not modify the original file', async () => {
        expect(await file.readTextFile(dest)).toEqual(await file.readTextFile(__filename))
      })
    })

    describe('when given a buffer', () => {
      beforeEach(async () => {
        await file.replaceContents(dest, Buffer.from('aa', 'utf8'))
      })

      it('replaces the contents of the file', async () => {
        expect(await file.readTextFile(dest)).toEqual('aa')
      })
    })

    describe('when given a string', () => {
      beforeEach(async () => {
        await file.replaceContents(dest, 'aa')
      })

      it('replaces the contents of the file', async () => {
        expect(await file.readTextFile(dest)).toEqual('aa')
      })
    })
  })

  describe('rm', () => {
    describe('for a directory', () => {
      describe('when the directory does not exist', () => {
        it('does not throw', async () => {
          await file.rm('nosuchdir')
        })
      })

      describe('when the directory exists and is not empty', () => {
        let dir: string
        let dirTmp: tmp.DirectoryResult

        beforeEach(async () => {
          dirTmp = await tmp.dir()
          dir = dirTmp.path
          await fs.promises.copyFile(__filename, path.join(dir, 'a_file'))
          await file.rm(dir)
        })

        it('removes the dir', async () => {
          expect(await file.exists(dir)).toBeFalsy()
        })
      })
    })

    describe('for a file', () => {
      describe('when the file does not exist', () => {
        it('does not throw', async () => {
          await file.rm('nosuchfile')
        })
      })

      describe('when the file exists', () => {
        let fileTmp: tmp.FileResult
        let filename: string

        beforeEach(async () => {
          fileTmp = await tmp.file()
          filename = fileTmp.path
          expect(await file.exists(filename)).toBeTruthy()
          await file.rm(filename)
        })

        afterEach(async () => {
          await fileTmp.cleanup()
        })

        it('removes the file', async () => {
          expect(await file.exists(filename)).toBeFalsy()
        })
      })
    })
  })

  describe('mkdirp', () => {
    let parentDir: string
    let dirTmp: tmp.DirectoryResult
    let dir: string
    const dirBaseName = 'my_dir'

    beforeEach(async () => {
      dirTmp = await tmp.dir()
      parentDir = dirTmp.path
      dir = path.join(parentDir, dirBaseName)
    })

    afterEach(async () => {
      await rimRaf(parentDir)
    })

    describe('when the parent directory exists', () => {
      beforeEach(async () => {
        await file.mkdirp(dir)
      })

      it('creates the dir', async () => {
        const s = await file.stat(dir)
        expect(s.isDirectory()).toBeTruthy()
      })
    })

    describe('when the parent directory does not exist', () => {
      beforeEach(async () => {
        await file.rm(parentDir)
        expect(await file.exists(parentDir)).toBeFalsy()
        await file.mkdirp(dir)
      })

      it('creates the dir', async () => {
        const s = await file.stat(dir)
        expect(s.isDirectory()).toBeTruthy()
      })
    })
  })
  describe('isEmptyDir', () => {
    let dir: string

    beforeEach(async () => {
      dir = (await tmp.dir()).path
    })

    afterEach(async () => {
      await file.rm(dir)
    })

    describe('when given an empty directory', () => {
      it('returns true', async () => {
        expect(await file.isEmptyDir(dir)).toBe(true)
      })
    })

    describe('when given a non-empty directory', () => {
      describe('with a subdirectory', () => {
        beforeEach(async () => {
          await file.mkdirp(path.join(dir, 'subdir'))
        })

        it('returns false', async () => {
          expect(await file.isEmptyDir(dir)).toBe(false)
        })
      })

      describe('with a file', () => {
        beforeEach(async () => {
          await file.writeFile(path.join(dir, 'somefile'), '')
        })

        it('returns false', async () => {
          expect(await file.isEmptyDir(dir)).toBe(false)
        })
      })
    })
  })

  describe('readDir', () => {
    let dir: string

    beforeEach(async () => {
      dir = (await tmp.dir()).path
    })

    afterEach(async () => {
      await file.rm(dir)
    })

    describe('when given an empty directory', () => {
      it('returns empty list', async () => {
        expect(await file.readDir(dir)).toEqual([])
      })
    })

    describe('when given a non-empty directory', () => {
      describe('with a subdirectory', () => {
        beforeEach(async () => {
          await file.mkdirp(path.join(dir, 'subdir'))
        })

        it('returns false', async () => {
          expect(await file.readDir(dir)).toEqual(['subdir'])
        })
      })

      describe('with files', () => {
        beforeEach(async () => {
          await file.writeFile(path.join(dir, 'somefile1'), '')
          await file.writeFile(path.join(dir, 'somefile2'), '')
        })

        it('returns false', async () => {
          expect(await file.readDir(dir)).toEqual(['somefile1', 'somefile2'])
        })
      })
    })
  })

  describe('isSubDirectory', () => {
    describe('when given a subdirectory', () => {
      it('returns true', () => {
        expect(file.isSubDirectory('/base/child', '/base')).toBe(true)
        expect(file.isSubDirectory('../base/child', '../base')).toBe(true)
      })
    })

    describe('when given a non-subdirectory', () => {
      it('returns false', () => {
        expect(file.isSubDirectory('../base/child', '../test')).toBe(false)
        expect(file.isSubDirectory('/base/child', '/test')).toBe(false)
      })
    })

    describe('when given the same directory', () => {
      it('returns true', () => {
        expect(file.isSubDirectory('/base', '/base')).toBe(true)
        expect(file.isSubDirectory('../base', '../base')).toBe(true)
      })
    })
  })
})
