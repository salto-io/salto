import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import tmp from 'tmp-promise'
import rimRafLib from 'rimraf'
import {
  stat, readTextFile, readFile, exists, copyFile, rm, mkdirp, writeTextFile, appendTextFile,
} from '../src/file'

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
      it('should reject with ErrnoException', () => {
        expectRejectWithErrnoException(() => stat('nosuchfile'))
      })
    })

    describe('when the file exists', () => {
      it('should return its stats', async () => {
        // can't compare all stats since aTime and aTimeMs might differ slightly
        const r = (await stat(__filename)).ctime
        expect(r).toEqual((await promisify(fs.stat)(__filename)).ctime)
      })
    })
  })

  describe('stat.notFoundAsUndefined', () => {
    describe('when the file does not exist', () => {
      it('should return undefined', async () => {
        const r = await stat.notFoundAsUndefined('nosuchfile')
        expect(r).toBeUndefined()
      })
    })

    describe('when the file exists', () => {
      it('should return its stats', async () => {
        const r = await stat(__filename)
        expect(r).toEqual(await promisify(fs.stat)(__filename))
      })
    })
  })

  describe('exists', () => {
    describe('when the file does not exist', () => {
      it('should return false', async () => {
        expect(await exists('nosuchfile')).toBe(false)
      })
    })

    describe('when the file exists', () => {
      it('should return true', async () => {
        expect(await exists(__filename)).toBe(true)
      })
    })
  })

  describe('readFile', () => {
    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', () => {
        expectRejectWithErrnoException(() => readFile('nosuchfile'))
      })
    })

    describe('when the file exists', () => {
      it('should return its contents', async () => {
        const r = await readFile(__filename)
        expect(r).toEqual(await fs.promises.readFile(__filename))
      })
    })
  })

  describe('readFile.notFoundAsUndefined', () => {
    describe('when the file exists', () => {
      it('should return its contents as text', async () => {
        const r = await readFile.notFoundAsUndefined(__filename)
        expect(r).toEqual(await fs.promises.readFile(__filename))
      })
    })

    describe('when the file does not exist', () => {
      it('should return undefined', async () => {
        const r = await readFile.notFoundAsUndefined('nosuchfile')
        expect(r).toBeUndefined()
      })
    })
  })

  describe('readTextFile', () => {
    describe('when the file does not exist', () => {
      it('should reject with ErrnoException', () => {
        expectRejectWithErrnoException(() => readTextFile('nosuchfile'))
      })
    })

    describe('when the file exists', () => {
      it('should return its contents', async () => {
        const r = await readTextFile(__filename)
        expect(r).toEqual(await fs.promises.readFile(__filename, { encoding: 'utf8' }))
      })
    })
  })

  describe('readTextFile.notFoundAsUndefined', () => {
    describe('when the file exists', () => {
      it('should return its contents as text', async () => {
        const r = await readTextFile.notFoundAsUndefined(__filename)
        expect(r).toEqual(await fs.promises.readFile(__filename, { encoding: 'utf8' }))
      })
    })

    describe('when the file does not exist', () => {
      it('should return undefined', async () => {
        const r = await readTextFile.notFoundAsUndefined('nosuchfile')
        expect(r).toBeUndefined()
      })
    })
  })

  describe('writeTextFile', () => {
    const source = __filename
    let destTmp: tmp.FileResult
    let dest: string

    beforeEach(async () => {
      destTmp = await tmp.file()
      dest = destTmp.path
      await copyFile(source, dest)
    })

    afterEach(async () => {
      await destTmp.cleanup()
    })

    describe('when the file exists', () => {
      beforeEach(async () => {
        expect(await exists(dest)).toBeTruthy()
        await writeTextFile(dest, 'a')
      })

      it('overwrites its contents', async () => {
        const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
        const expectedContents = 'a'
        expect(contents).toEqual(expectedContents)
      })
    })

    describe('when the file does not exist', () => {
      beforeEach(async () => {
        await rm(dest)
        expect(await exists(dest)).toBeFalsy()
        await writeTextFile(dest, 'a')
      })

      it('writes the contents to the file', async () => {
        const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
        const expectedContents = 'a'
        expect(contents).toEqual(expectedContents)
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
      await copyFile(source, dest)
    })

    afterEach(async () => {
      await destTmp.cleanup()
    })

    describe('when the file exists', () => {
      beforeEach(async () => {
        expect(await exists(dest)).toBeTruthy()
        await appendTextFile(dest, 'a')
      })

      it('appends to it', async () => {
        const contents = await fs.promises.readFile(dest, { encoding: 'utf8' })
        const expectedContents = `${await fs.promises.readFile(source, { encoding: 'utf8' })}a`
        expect(contents).toEqual(expectedContents)
      })
    })

    describe('when the file does not exist', () => {
      beforeEach(async () => {
        await rm(dest)
        expect(await exists(dest)).toBeFalsy()
        await appendTextFile(dest, 'a')
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
      await copyFile(source, dest)
    })

    afterEach(async () => {
      await destTmp.cleanup()
    })

    it('copies the file', async () => {
      expect(await readTextFile(dest)).toEqual(await readTextFile(source))
    })
  })

  describe('rm', () => {
    describe('for a directory', () => {
      describe('when the directory does not exist', () => {
        it('does not throw', async () => {
          await rm('nosuchdir')
        })
      })

      describe('when the directory exists and is not empty', () => {
        let dir: string
        let dirTmp: tmp.DirectoryResult

        beforeEach(async () => {
          dirTmp = await tmp.dir()
          dir = dirTmp.path
          await fs.promises.copyFile(__filename, path.join(dir, 'a_file'))
          await rm(dir)
        })

        it('removes the dir', async () => {
          expect(await exists(dir)).toBeFalsy()
        })
      })
    })

    describe('for a file', () => {
      describe('when the file does not exist', () => {
        it('does not throw', async () => {
          await rm('nosuchfile')
        })
      })

      describe('when the file exists', () => {
        let fileTmp: tmp.FileResult
        let filename: string

        beforeEach(async () => {
          fileTmp = await tmp.file()
          filename = fileTmp.path
          expect(await exists(filename)).toBeTruthy()
          await rm(filename)
        })

        afterEach(async () => {
          await fileTmp.cleanup()
        })

        it('removes the file', async () => {
          expect(await exists(filename)).toBeFalsy()
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
        await mkdirp(dir)
      })

      it('creates the dir', async () => {
        const s = await stat(dir)
        expect(s.isDirectory()).toBeTruthy()
      })
    })

    describe('when the parent directory does not exist', () => {
      beforeEach(async () => {
        await rm(parentDir)
        expect(await exists(parentDir)).toBeFalsy()
        await mkdirp(dir)
      })

      it('creates the dir', async () => {
        const s = await stat(dir)
        expect(s.isDirectory()).toBeTruthy()
      })
    })
  })
})
