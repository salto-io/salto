import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import tmpLib from 'tmp'
import rimRafLib from 'rimraf'

import {
  stat, readTextFile, readFile, exists, copyFile, rm, mkdirp, writeTextFile, appendTextFile,
} from '../src/file'

const tmpFile = promisify(tmpLib.file)
const tmpDir = promisify(tmpLib.dir)
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
    let dest: string

    beforeEach(async () => {
      dest = await tmpFile()
      await copyFile(source, dest)
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
    let dest: string

    beforeEach(async () => {
      dest = await tmpFile()
      await copyFile(source, dest)
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
    let dest: string

    beforeEach(async () => {
      dest = await tmpFile()
      copyFile(source, dest)
    })

    afterEach(() => {
      rimRaf(dest)
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

        beforeEach(async () => {
          dir = await tmpDir()
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
        let filename: string

        beforeEach(async () => {
          filename = await tmpFile()
          expect(await exists(filename)).toBeTruthy()
          await rm(filename)
        })

        it('removes the file', async () => {
          expect(await exists(filename)).toBeFalsy()
        })
      })
    })
  })

  describe('mkdirp', () => {
    describe('when the parent directory exists', () => {
      let parentDir: string
      let dir: string
      const dirBaseName = 'my_dir'

      beforeEach(async () => {
        parentDir = await tmpDir()
        dir = path.join(parentDir, dirBaseName)
        await mkdirp(dir)
      })

      it('creates the dir', async () => {
        const s = await stat(dir)
        expect(s.isDirectory()).toBeTruthy()
      })
    })

    describe('when the parent directory does not exist', () => {
      let parentDir: string
      let dir: string
      const dirBaseName = 'my_dir'

      beforeEach(async () => {
        parentDir = await tmpDir()
        await rm(parentDir)
        expect(await exists(parentDir)).toBeFalsy()
        dir = path.join(parentDir, dirBaseName)
        await mkdirp(dir)
      })

      it('creates the dir', async () => {
        const s = await stat(dir)
        expect(s.isDirectory()).toBeTruthy()
      })
    })
  })
})
