/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import fs from 'fs'
import path from 'path'
import { setupTmpDir } from '@salto-io/test-utils'
import { isProjectFolder, createProject } from '../../src/sfdx_parser/project'

describe('checkProject', () => {
  const setupTmpProject = (): ReturnType<typeof setupTmpDir> => {
    const tmpDir = setupTmpDir('all')
    beforeAll(async () => {
      await fs.promises.cp(path.join(__dirname, 'test_sfdx_project'), tmpDir.name(), { recursive: true })
    })
    return tmpDir
  }

  describe('when there is a project in the directory', () => {
    const project = setupTmpProject()

    it('should return true', async () => {
      const result = await isProjectFolder({ baseDir: project.name() })
      expect(result).toBeTrue()
    })
  })

  describe('when there is no project in the directory', () => {
    const project = setupTmpDir('all')

    it('should return false', async () => {
      const result = await isProjectFolder({ baseDir: project.name() })
      expect(result).toBeFalse()
    })
  })
})

describe('createProject', () => {
  const project = setupTmpDir('all')

  beforeEach(async () => {
    await createProject({ baseDir: project.name() })
  })

  it('should create a project', () => {
    expect(fs.existsSync(path.join(project.name(), 'sfdx-project.json'))).toBeTrue()
  })
})
