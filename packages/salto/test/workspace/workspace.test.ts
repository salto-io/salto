import _ from 'lodash'
import fs from 'async-file'
import path from 'path'
import tmp from 'tmp-promise'

import {
  Element, ObjectType, ElemID, Type,
} from 'adapter-api'
import {
  Workspace, Blueprint, ParsedBlueprint, parseBlueprints,
} from '../../src/workspace/workspace'
import { DetailedChange } from '../../src/core/plan'

describe('Workspace', () => {
  const workspaceFiles = {
    '/salto/file.bp': `
type salesforce_lead {
  salesforce_text base_field {
    ${Type.DEFAULT} = "asd"
  }
  list number list_field {
    ${Type.DEFAULT} = [
      1,
      2,
      3,
      4,
      5
    ]
  }
}
type multi_loc { a = 1 }
type one_liner { a = 1 }`,
    '/salto/subdir/file.bp': `
type salesforce_lead {
  salesforce_text ext_field {
    ${Type.DEFAULT} = "foo"
  }
}
type multi_loc { b = 1 }`,
    '/salto/subdir/.hidden.bp': 'type hidden_type {}',
    '/salto/non_bp.txt': 'type hidden_non_bp {}',
    '/salto/.hidden/hidden.bp': 'type hidden_directory {}',
    '/outside/file.bp': 'type external_file {}',
    '/error.bp': 'invalid syntax }}',
    '/dup.bp': `
type salesforce_lead {
  string base_field {}
}`,
  }

  const changedBP = {
    filename: 'file.bp',
    buffer: `type salesforce_lead {
      salesforce_text new_base {}
    }`,
  }
  const newBP = {
    filename: 'new.bp',
    buffer: 'type salesforce_new {}',
  }

  describe('Workspace class', () => {
    let parsedBPs: ParsedBlueprint[]
    beforeAll(async () => {
      const bps: Blueprint[] = _.entries(workspaceFiles)
        .map(([filename, buffer]) => ({ filename: path.relative('/salto', filename), buffer }))
      parsedBPs = await parseBlueprints(bps)
    })

    let workspace: Workspace
    let elemMap: Record<string, Element>
    const updateElemMap = (): void => {
      elemMap = _(workspace.elements)
        .map(elem => [elem.elemID.getFullName(), elem])
        .fromPairs()
        .value()
    }
    const resetWorkspace = (): void => {
      workspace = new Workspace(
        '/salto',
        parsedBPs.filter(bp => !bp.filename.startsWith('..') || bp.filename === '../outside/file.bp'),
      )
      updateElemMap()
    }

    beforeAll(resetWorkspace)

    describe('loaded elements', () => {
      it('should contain types from all files', () => {
        expect(elemMap).toHaveProperty('salesforce_lead')
        expect(elemMap).toHaveProperty('external_file')
      })
      it('should be merged', () => {
        const lead = elemMap.salesforce_lead as ObjectType
        expect(_.keys(lead.fields)).toHaveLength(3)
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
          parsedBPs.filter(bp => !bp.filename.startsWith('..') || bp.filename === '../error.bp'),
        )
        expect(erroredWorkspace.errors).toHaveLength(1)
      })
      it('should contain validation errors', async () => {
        const erroredWorkspace = new Workspace(
          '/salto',
          parsedBPs.filter(bp => !bp.filename.startsWith('..') || bp.filename === '../dup.bp'),
        )
        expect(erroredWorkspace.errors).toHaveLength(1)
      })
    })

    describe('removeBlueprints', () => {
      let removedPaths: string[]
      beforeAll(() => {
        resetWorkspace()
        removedPaths = ['../outside/file.bp', 'file.bp']
        workspace.removeBlueprints(...removedPaths)
        updateElemMap()
      })
      afterAll(resetWorkspace)

      it('should remove blueprints from parsed blueprints', () => {
        removedPaths.forEach(
          filename => expect(_.keys(workspace.parsedBlueprints)).not.toContain(filename)
        )
      })
      it('should update elements to not include fields from removed blueprints', () => {
        const lead = elemMap.salesforce_lead as ObjectType
        expect(_.keys(lead.fields)).toHaveLength(1)
      })
    })

    describe('setBlueprints', () => {
      beforeAll(async () => {
        resetWorkspace()
        await workspace.setBlueprints(changedBP, newBP)
        updateElemMap()
      })
      afterAll(resetWorkspace)

      it('should add new blueprints', () => {
        expect(_.keys(workspace.parsedBlueprints)).toContain('new.bp')
      })
      it('should add new elements', () => {
        expect(elemMap).toHaveProperty('salesforce_new')
      })
      it('should update elements', () => {
        const lead = elemMap.salesforce_lead as ObjectType
        expect(lead.fields.new_base).toBeDefined()
        expect(lead.fields.base_field).not.toBeDefined()
      })
    })

    describe('updateBlueprints', () => {
      const newElemID = new ElemID('salesforce', 'new_elem')
      const newElem = new ObjectType({ elemID: newElemID })
      newElem.path = ['test', 'new']
      const changes: DetailedChange[] = [
        { // modify value
          id: new ElemID('salesforce', 'lead', 'base_field', Type.DEFAULT),
          action: 'modify',
          data: { before: 'asd', after: 'foo' },
        },
        { // add element (top level)
          id: newElemID,
          action: 'add',
          data: { after: newElem },
        },
        { // add complex value (nested in parent scope)
          id: new ElemID('salesforce', 'lead', 'base_field', 'complex'),
          action: 'add',
          data: { after: { key: 'value' } },
        },
        { // remove value
          id: new ElemID('salesforce', 'lead', 'ext_field', Type.DEFAULT),
          action: 'remove',
          data: { before: 'foo' },
        },
        { // Add value to empty scope
          id: new ElemID('external', 'file', Type.DEFAULT),
          action: 'add',
          data: { after: 'some value' },
        },
        // TODO: this is currently not supported
        // { // Add value to one liner scope
        //   id: new ElemID('one', 'liner', 'label'),
        //   action: 'add',
        //   data: { after: 'label' },
        // },
        { // Remove element from multiple locations
          id: new ElemID('multi', 'loc'),
          action: 'remove',
          data: { before: new ObjectType({ elemID: new ElemID('multi', 'loc') }) },
        },
        { // Modify value in list
          id: new ElemID('salesforce', 'lead', 'list_field', Type.DEFAULT, '3'),
          action: 'modify',
          data: { before: 4, after: 5 },
        },
      ]

      beforeAll(async () => {
        resetWorkspace()
        await workspace.updateBlueprints(...changes)
        updateElemMap()
      })
      afterAll(resetWorkspace)

      it('should not cause parse errors', () => {
        expect(workspace.errors).toHaveLength(0)
      })
      it('should modify existing element', () => {
        const lead = elemMap.salesforce_lead as ObjectType
        expect(lead).toBeDefined()
        expect(lead.fields.base_field.annotations[Type.DEFAULT]).toEqual('foo')
      })
      it('should update existing parsed blueprints content', () => {
        const updatedBlueprint = workspace.parsedBlueprints['file.bp']
        expect(updatedBlueprint.buffer).toMatch(/base_field\s+{\s+_default = "foo"/s)
      })
      it('should add new element', () => {
        expect(elemMap[newElemID.getFullName()]).toBeDefined()
      })
      it('should add new blueprint', () => {
        expect(Object.keys(workspace.parsedBlueprints)).toContain('test/new.bp')
      })
      it('should add annotations under correct field', () => {
        const lead = elemMap.salesforce_lead as ObjectType
        expect(lead.fields.base_field.annotations).toHaveProperty('complex')
        expect(lead.fields.base_field.annotations.complex).toEqual({ key: 'value' })
      })
      it('should remove all definitions in remove', () => {
        expect(Object.keys(elemMap)).not.toContain('multi_loc')
      })
      it('should update value in list', () => {
        const lead = elemMap.salesforce_lead as ObjectType
        expect(lead.fields.list_field.annotations[Type.DEFAULT]).toEqual([1, 2, 3, 5, 5])
      })
    })
  })

  describe('filesystem interaction', () => {
    let tmpDir: tmp.DirectoryResult
    let workspace: Workspace

    const resetWorkspace = async (): Promise<void> => {
      if (tmpDir !== undefined) {
        tmpDir.cleanup()
      }
      tmpDir = await tmp.dir({ unsafeCleanup: true })
      const getPath = (filename: string): string => path.join(tmpDir.path, filename)
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
        expect(_.keys(workspace.parsedBlueprints)).toContain('file.bp')
        expect(_.keys(workspace.parsedBlueprints)).toContain('subdir/file.bp')
      })
      it('should find files that are added explicitly', () => {
        expect(_.keys(workspace.parsedBlueprints)).toContain('../outside/file.bp')
      })
      it('should not find hidden files and directories', () => {
        expect(_.keys(workspace.parsedBlueprints)).not.toContain('subdir/.hidden.bp')
        expect(_.keys(workspace.parsedBlueprints)).not.toContain('.hidden/hidden.bp')
      })
      it('should not find non bp files', () => {
        expect(_.keys(workspace.parsedBlueprints)).not.toContain('non_bp.txt')
      })
    })
    describe('flush', () => {
      beforeAll(async () => {
        await resetWorkspace()
        workspace.removeBlueprints('subdir/file.bp')
        await workspace.setBlueprints(changedBP, newBP)
        await workspace.flush()
      })
      afterAll(resetWorkspace)

      it('should remove blueprints that were removed', async () => {
        expect(await fs.exists(path.join(workspace.baseDir, 'subdir/file.bp'))).toBeFalsy()
      })
      it('should create blueprints that were added', async () => {
        expect(await fs.exists(path.join(workspace.baseDir, newBP.filename))).toBeTruthy()
      })
      it('should change the content of blueprints that were updated', async () => {
        const writtenData = await fs.readFile(path.join(workspace.baseDir, changedBP.filename), 'utf8')
        expect(writtenData).toEqual(changedBP.buffer)
      })
      it('should keep all unchanged files', async () => {
        await Promise.all(_.keys(workspace.parsedBlueprints).map(
          async p => expect(await fs.exists(path.join(workspace.baseDir, p))).toBeTruthy()
        ))
      })
    })
  })
})
