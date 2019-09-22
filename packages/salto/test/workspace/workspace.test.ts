import _ from 'lodash'
import fs from 'async-file'
import path from 'path'
import tmp from 'tmp-promise'

import { Element, ObjectType } from 'adapter-api'
import { Workspace, loadWorkspace } from '../../src/workspace/workspace'

describe('Workspace', () => {
  let tmpDir: tmp.DirectoryResult
  beforeEach(async () => {
    const workspaceFiles = {
      '/salto/file.bp': `type salesforce_lead {
        salesforce_text base_field {
          _default = "asd"
        }
      }`,
      '/salto/subdir/file.bp': `type salesforce_lead {
        salesforce_text ext_field {
          _default = "foo"
        }
      }`,
      '/salto/subdir/.hidden.bp': 'type hidden_type {}',
      '/salto/non_bp.txt': 'type hidden_non_bp {}',
      '/salto/.hidden/hidden.bp': 'type hidden_directory {}',
      '/outside/file.bp': 'type external_file {}',
      '/error.bp': 'invalid syntax }}',
    }

    tmpDir = await tmp.dir({ unsafeCleanup: true })
    await Promise.all(_.entries(workspaceFiles)
      .map(async ([name, data]) => {
        const filePath = path.join(tmpDir.path, name)
        await fs.mkdirp(path.dirname(filePath))
        return fs.writeFile(filePath, data)
      }))
  })

  afterEach(() => {
    tmpDir.cleanup()
  })

  const getPath = (filename: string): string => path.join(tmpDir.path, filename)

  let workspace: Workspace

  beforeEach(async () => {
    workspace = await loadWorkspace(getPath('salto'), [getPath('/outside/file.bp')])
  })

  describe('loadWorkspace', () => {
    describe('loading blueprints from directory', () => {
      it('should find blueprint files', () => {
        expect(_.keys(workspace.parsedBlueprints)).toContain(getPath('/salto/file.bp'))
        expect(_.keys(workspace.parsedBlueprints)).toContain(getPath('/salto/subdir/file.bp'))
      })
      it('should find files that are added explicitly', () => {
        expect(_.keys(workspace.parsedBlueprints)).toContain(getPath('/outside/file.bp'))
      })
      it('should not find hidden files and directories', () => {
        expect(_.keys(workspace.parsedBlueprints)).not.toContain(getPath('/salto/subdir/.hidden.bp'))
        expect(_.keys(workspace.parsedBlueprints)).not.toContain(getPath('/salto/.hidden/hidden.bp'))
      })
      it('should not find non bp files', () => {
        expect(_.keys(workspace.parsedBlueprints)).not.toContain(getPath('/salto/non_bp.txt'))
      })
    })

    describe('loaded elements', () => {
      let elemMap: Record<string, Element>
      beforeEach(() => {
        elemMap = _(workspace.elements)
          .map(elem => [elem.elemID.getFullName(), elem])
          .fromPairs()
          .value()
      })

      it('should contain types from all files', () => {
        expect(elemMap).toHaveProperty('salesforce_lead')
        expect(elemMap).toHaveProperty('external_file')
      })
      it('should be merged', () => {
        const lead = elemMap.salesforce_lead as ObjectType
        expect(_.keys(lead.fields)).toHaveLength(2)
      })
    })

    describe('sourceMap', () => {
      it('should have definitions from all files', () => {
        expect(workspace.sourceMap.get('salesforce_lead')).toHaveLength(2)
      })
    })

    describe('errors', () => {
      it('should be empty when there are no errors', () => {
        expect(workspace.errors).toHaveLength(0)
      })
      it('should contain parse errors', async () => {
        const erroredWorkspace = await loadWorkspace(getPath('salto'), [getPath('error.bp')])
        expect(erroredWorkspace.errors).toHaveLength(1)
      })
    })
  })

  describe('removeBlueprints', () => {
    let newWorkspace: Workspace
    let newElemMap: Record<string, Element>
    let removedPaths: string[]
    beforeEach(() => {
      removedPaths = [getPath('/outside/file.bp'), getPath('salto/file.bp')]
      newWorkspace = workspace.removeBlueprints(removedPaths)
      newElemMap = _(newWorkspace.elements)
        .map(elem => [elem.elemID.getFullName(), elem])
        .fromPairs()
        .value()
    })

    it('should not change the original workspace', () => {
      removedPaths.forEach(
        filename => expect(_.keys(workspace.parsedBlueprints)).toContain(filename)
      )
    })
    describe('returned workspace', () => {
      it('should not have the removed blueprints', () => {
        removedPaths.forEach(
          filename => expect(_.keys(newWorkspace.parsedBlueprints)).not.toContain(filename)
        )
      })
      it('should have updated elements', () => {
        const lead = newElemMap.salesforce_lead as ObjectType
        expect(_.keys(lead.fields)).toHaveLength(1)
      })
    })
    describe('flush', () => {
      beforeEach(async () => {
        await newWorkspace.flush()
      })
      it('should delete the blueprint files', async () => {
        await Promise.all(removedPaths.map(
          async p => expect(await fs.exists(p)).toBeFalsy()
        ))
      })
      it('should keep the rest of the files', async () => {
        await Promise.all(_.keys(newWorkspace.parsedBlueprints).map(
          async p => expect(await fs.exists(p)).toBeTruthy()
        ))
      })
    })
  })

  describe('updateBlueprints', () => {
    let newWorkspace: Workspace
    let newElemMap: Record<string, Element>
    beforeEach(async () => {
      const changedBP = {
        filename: getPath('/salto/file.bp'),
        buffer: Buffer.from(`type salesforce_lead {
          salesforce_text new_base {}
        }`),
      }
      const newBP = {
        filename: getPath('/salto/new.bp'),
        buffer: Buffer.from('type salesforce_new {}'),
      }
      newWorkspace = await workspace.updateBlueprints([changedBP, newBP])
      newElemMap = _(newWorkspace.elements)
        .map(elem => [elem.elemID.getFullName(), elem])
        .fromPairs()
        .value()
    })
    it('should not change the original workspace', () => {
      expect(_.keys(workspace.parsedBlueprints)).not.toContain(getPath('/salto/new.bp'))
    })
    describe('returned workspace', () => {
      it('should have new blueprints', () => {
        expect(_.keys(newWorkspace.parsedBlueprints)).toContain(getPath('/salto/new.bp'))
      })
      it('should have new elements', () => {
        expect(newElemMap).toHaveProperty('salesforce_new')
      })
      it('should have updated elements', () => {
        const lead = newElemMap.salesforce_lead as ObjectType
        expect(lead.fields.new_base).toBeDefined()
        expect(lead.fields.base_field).not.toBeDefined()
      })
    })
    describe('flush', () => {
      beforeEach(async () => {
        await newWorkspace.flush()
      })
      it('should create or keep all the files', async () => {
        await Promise.all(_.keys(newWorkspace.parsedBlueprints).map(
          async p => expect(await fs.exists(p)).toBeTruthy()
        ))
      })
      it('should update files content', async () => {
        const writtenData = await fs.readFile(getPath('/salto/file.bp'))
        const parsedBP = newWorkspace.parsedBlueprints[getPath('/salto/file.bp')]
        expect(writtenData).toEqual(parsedBP.buffer)
      })
    })
  })
})
