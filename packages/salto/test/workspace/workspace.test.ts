import _ from 'lodash'
import fs from 'async-file'
import path from 'path'
import tmp from 'tmp-promise'

import { Element, ObjectType } from 'adapter-api'
import {
  Workspace, Blueprint, ParsedBlueprint, parseBlueprints,
} from '../../src/workspace/workspace'

describe('Workspace', () => {
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
    '/dup.bp': `type salesforce_lead {
      string base_field {}
    }`,
  }

  const changedBP = {
    filename: '/salto/file.bp',
    buffer: `type salesforce_lead {
      salesforce_text new_base {}
    }`,
  }
  const newBP = {
    filename: '/salto/new.bp',
    buffer: 'type salesforce_new {}',
  }

  describe('Workspace class', () => {
    let parsedBPs: ParsedBlueprint[]
    beforeAll(async () => {
      const bps: Blueprint[] = _.entries(workspaceFiles)
        .map(([filename, buffer]) => ({ filename, buffer }))
      parsedBPs = await parseBlueprints(bps)
    })

    let workspace: Workspace
    beforeEach(() => {
      workspace = new Workspace(
        '/salto',
        parsedBPs.filter(bp => bp.filename.startsWith('/salto') || bp.filename === '/outside/file.bp'),
      )
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
        const erroredWorkspace = new Workspace(
          '/salto',
          parsedBPs.filter(bp => bp.filename.startsWith('/salto') || bp.filename === '/error.bp'),
        )
        expect(erroredWorkspace.errors).toHaveLength(1)
      })
      it('should contain validation errors', async () => {
        const erroredWorkspace = new Workspace(
          '/salto',
          parsedBPs.filter(bp => bp.filename.startsWith('/salto') || bp.filename === '/dup.bp'),
        )
        expect(erroredWorkspace.errors).toHaveLength(1)
      })
    })

    describe('removeBlueprints', () => {
      let newElemMap: Record<string, Element>
      let removedPaths: string[]
      beforeEach(() => {
        removedPaths = ['/outside/file.bp', '/salto/file.bp']
        workspace.removeBlueprints(...removedPaths)
        newElemMap = _(workspace.elements)
          .map(elem => [elem.elemID.getFullName(), elem])
          .fromPairs()
          .value()
      })

      it('should remove blueprints from parsed blueprints', () => {
        removedPaths.forEach(
          filename => expect(_.keys(workspace.parsedBlueprints)).not.toContain(filename)
        )
      })
      it('should update elements to not include fields from removed blueprints', () => {
        const lead = newElemMap.salesforce_lead as ObjectType
        expect(_.keys(lead.fields)).toHaveLength(1)
      })
    })

    describe('setBlueprints', () => {
      let newElemMap: Record<string, Element>
      beforeEach(async () => {
        await workspace.setBlueprints(changedBP, newBP)
        newElemMap = _(workspace.elements)
          .map(elem => [elem.elemID.getFullName(), elem])
          .fromPairs()
          .value()
      })

      it('should add new blueprints', () => {
        expect(_.keys(workspace.parsedBlueprints)).toContain('/salto/new.bp')
      })
      it('should add new elements', () => {
        expect(newElemMap).toHaveProperty('salesforce_new')
      })
      it('should update elements', () => {
        const lead = newElemMap.salesforce_lead as ObjectType
        expect(lead.fields.new_base).toBeDefined()
        expect(lead.fields.base_field).not.toBeDefined()
      })
    })
  })

  describe('filesystem interaction', () => {
    let tmpDir: tmp.DirectoryResult
    let workspace: Workspace
    let getPath: (filename: string) => string

    const resetWorkspace = async (): Promise<void> => {
      if (tmpDir !== undefined) {
        tmpDir.cleanup()
      }
      tmpDir = await tmp.dir({ unsafeCleanup: true })
      getPath = (filename: string): string => path.join(tmpDir.path, filename)
      await Promise.all(_.entries(workspaceFiles)
        .map(async ([name, data]) => {
          const filePath = getPath(name)
          await fs.mkdirp(path.dirname(filePath))
          return fs.writeFile(filePath, data)
        }))
      workspace = await Workspace.load(getPath('salto'), [getPath('/outside/file.bp')])
    }

    beforeAll(resetWorkspace)

    afterAll(() => {
      tmpDir.cleanup()
    })

    describe('Workspace load', () => {
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
    describe('flush', () => {
      beforeAll(async () => {
        await resetWorkspace()
        const updateBPs = [changedBP, newBP].map(
          ({ filename, buffer }) => ({ filename: getPath(filename), buffer })
        )
        workspace.removeBlueprints(getPath('/salto/subdir/file.bp'))
        await workspace.setBlueprints(...updateBPs)
        await workspace.flush()
      })
      afterAll(resetWorkspace)

      it('should remove blueprints that were removed', async () => {
        expect(await fs.exists(getPath('/salto/subdir/file.bp'))).toBeFalsy()
      })
      it('should create blueprints that were added', async () => {
        expect(await fs.exists(getPath('/salto/new.bp'))).toBeTruthy()
      })
      it('should change the content of blueprints that were updated', async () => {
        const writtenData = await fs.readFile(getPath('/salto/file.bp'), 'utf8')
        expect(writtenData).toEqual(changedBP.buffer)
      })
      it('should keep all unchanged files', async () => {
        await Promise.all(_.keys(workspace.parsedBlueprints).map(
          async p => expect(await fs.exists(p)).toBeTruthy()
        ))
      })
    })
  })
})
