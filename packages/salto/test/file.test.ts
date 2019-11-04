import fs from 'fs'
import { promisify } from 'util'
import { stat, readFile } from '../src/file'

describe('file', () => {
  describe('stat', () => {
    describe('when the file does not exist', () => {
      it('should return undefined', async () => {
        const r = await stat('nosuchfile')
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

  describe('readFile', () => {
    describe('when the file does not exist', () => {
      it('should return undefined', async () => {
        const r = await readFile('nosuchfile')
        expect(r).toBeUndefined()
      })
    })

    describe('when the file exists', () => {
      it('should return its contents', async () => {
        const r = await readFile(__filename)
        expect(r).toEqual(await promisify(fs.readFile)(__filename, { encoding: 'utf8' }))
      })
    })
  })
})
