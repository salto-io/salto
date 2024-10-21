/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import fs from 'fs'
import path from 'path'
import { InitFolderResult } from '@salto-io/adapter-api'
import { setupTmpDir } from '@salto-io/test-utils'
import { isProjectFolder, createProject } from '../../src/sfdx_parser/project'
import { setupTmpProject } from './utils'

describe('isProjectFolder', () => {
  describe('when there is a project in the directory', () => {
    const project = setupTmpProject()

    it('should return true', async () => {
      const result = await isProjectFolder({ baseDir: project.name() })
      expect(result).toEqual({
        result: true,
        errors: [],
      })
    })
  })

  describe('when there is no project in the directory', () => {
    const project = setupTmpDir('all')

    it('should return false', async () => {
      const result = await isProjectFolder({ baseDir: project.name() })
      expect(result).toEqual({
        result: false,
        errors: [],
      })
    })
  })
})

describe('createProject', () => {
  describe('when given a valid directory', () => {
    const project = setupTmpDir('all')
    let res: InitFolderResult

    beforeEach(async () => {
      res = await createProject({ baseDir: project.name() })
    })

    it('should create a project', () => {
      expect(res.errors).toBeEmpty()
      expect(fs.existsSync(path.join(project.name(), 'sfdx-project.json'))).toBeTrue()
    })
  })

  describe('when given an invalid directory', () => {
    let res: InitFolderResult

    beforeEach(async () => {
      res = await createProject({ baseDir: '/dev/null' })
    })

    it('should return an error', () => {
      expect(res.errors).toEqual([
        expect.objectContaining({
          severity: 'Error',
          message: 'Failed initializing SFDX project',
        }),
      ])
    })
  })
})
