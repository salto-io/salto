import os from 'os'
import path from 'path'
import _ from 'lodash'
import {
  Element, ObjectType, ElemID, CORE_ANNOTATIONS, Field, BuiltinTypes,
  findElement, isObjectType,
} from 'adapter-api'
import BlueprintsStore from 'src/workspace/blueprints_store'
import { ParsedBlueprintMap } from '../../src/workspace/blueprints_state'
import { Workspace } from '../../src/workspace/workspace'
import { DetailedChange } from '../../src/core/plan'
import * as file from '../../src/file'
import { UnresolvedReferenceValidationError, InvalidValueValidationError } from '../../src/core/validator'

import * as dump from '../../src/parser/dump'
import * as localBpStore from '../../src/workspace/local/blueprints_store'
import * as config from '../../src/workspace/config'
import * as localCach from '../../src/workspace/local/cache'

import { mockBpsStore } from '../common/blueprint_store'

const changedBP = {
  filename: 'file.bp',
  buffer: `type salesforce_lead {
    salesforce_text new_base {}
  }`,
}
const emptyBP = {
  filename: 'willbempty.bp',
  buffer: ' ',
}
const newBP = {
  filename: 'new.bp',
  buffer: 'type salesforce_new {}',
}
const services = ['salesforce']

const createWorkspace = (bpStore?: BlueprintsStore): Workspace => {
  (localBpStore.localBlueprintsStore as jest.Mock).mockReturnValueOnce(bpStore || mockBpsStore())
  return new Workspace({
    uid: '',
    name: 'test',
    localStorage: path.join(os.homedir(), '.salto', 'test'),
    baseDir: '/salto',
    services,
    stateLocation: '/salto/latest_state.bp',
  })
}

const getElemMap = (elements: ReadonlyArray<Element>): Record<string, Element> =>
  _.keyBy(elements, elem => elem.elemID.getFullName())

jest.mock('../../src/workspace/local/blueprints_store')
jest.mock('../../src/workspace/local/cache')
describe('workspace', () => {
  // TODO: test with cache
  const cache = localCach.localParseResultCache as jest.Mock
  cache.mockReturnValue({
    put: () => Promise.resolve(),
    get: () => Promise.resolve(undefined),
  })

  describe('loaded elements', () => {
    const workspace = createWorkspace()
    let elemMap: Record<string, Element>
    beforeAll(async () => {
      elemMap = getElemMap(await workspace.elements)
    })
    it('should contain types from all files', () => {
      expect(elemMap).toHaveProperty(['salesforce.lead'])
      expect(elemMap).toHaveProperty(['multi.loc'])
    })
    it('should be merged', () => {
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(_.keys(lead.fields)).toHaveLength(4)
    })

    it('should have parsed blueprints', async () => {
      expect(_.size(await workspace.parsedBlueprints)).toBe(3)
    })
  })

  describe('sourceMap', () => {
    const workspace = createWorkspace()

    it('should have definitions from all files', async () => {
      const sourceRanges = await workspace.getSourceRanges(ElemID.fromFullName('salesforce.lead'))
      expect(sourceRanges).toHaveLength(2)
    })
  })

  describe('errors', () => {
    it('should be empty when there are no errors', async () => {
      const workspace = createWorkspace()
      expect((await workspace.errors).hasErrors()).toBeFalsy()
      expect(await workspace.hasErrors()).toBeFalsy()
      expect(await workspace.getWorkspaceErrors()).toHaveLength(0)
    })
    it('should contain parse errors', async () => {
      const erroredWorkspace = createWorkspace(mockBpsStore(['dup.bp']))

      const errors = await erroredWorkspace.errors
      expect(errors.hasErrors()).toBeTruthy()
      const err = 'Expected ws, comment or word token but found: } instead.'
      expect(errors.strings()[0]).toMatch(err)
      expect(errors.parse[0].detail).toMatch(err)

      expect(await erroredWorkspace.hasErrors()).toBeTruthy()
      const workspaceErrors = await erroredWorkspace.getWorkspaceErrors()
      expect(workspaceErrors.length).toBeGreaterThanOrEqual(1)
    })
    it('should contain merge errors', async () => {
      const erroredWorkspace = createWorkspace(mockBpsStore(['error.bp']))

      const errors = await erroredWorkspace.errors
      expect(errors.hasErrors()).toBeTruthy()
      const mergeError = /Cannot merge/
      expect(errors.strings()[0]).toMatch(mergeError)
      expect(errors.merge[0].error).toMatch(mergeError)

      expect(await erroredWorkspace.hasErrors()).toBeTruthy()
      const workspaceErrors = await erroredWorkspace.getWorkspaceErrors()
      expect(workspaceErrors).toHaveLength(1)
      const wsErros = workspaceErrors[0]
      expect(wsErros.sourceFragments).toHaveLength(2)
      expect(wsErros.message).toMatch(mergeError)
      expect(wsErros.severity).toBe('Error')
      const firstSourceFragment = wsErros.sourceFragments[0]
      expect(firstSourceFragment.sourceRange.filename).toBe('file.bp')
      expect(firstSourceFragment.sourceRange.start).toEqual({ byte: 24, col: 1, line: 3 })
      expect(firstSourceFragment.sourceRange.end).toEqual({ byte: 73, col: 2, line: 5 })
      expect(firstSourceFragment.fragment).toContain('salesforce_text base_field')
    })
  })

  describe('removeBlueprints', () => {
    const bpStore = mockBpsStore()
    const workspace = createWorkspace(bpStore)
    const removedPaths = ['file.bp', 'willbempty.bp']
    let elemMap: Record<string, Element>

    beforeAll(async () => {
      await workspace.removeBlueprints(...removedPaths)
      elemMap = getElemMap(await workspace.elements)
    })

    it('should remove blueprints from parsed blueprints', () => {
      removedPaths.forEach(
        filename => expect(_.keys(workspace.parsedBlueprints)).not.toContain(filename)
      )
    })

    it('should update elements to not include fields from removed blueprints', () => {
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(_.keys(lead.fields)).toHaveLength(1)
    })

    it('should remove from store', () => {
      const mockStoreDelete = bpStore.delete as jest.Mock
      expect(mockStoreDelete.mock.calls.map(c => c[0])).toEqual(removedPaths)
    })
  })

  describe('setBlueprints', () => {
    const bpStore = mockBpsStore()
    const workspace = createWorkspace(bpStore)
    let elemMap: Record<string, Element>

    beforeAll(async () => {
      await workspace.setBlueprints(changedBP, newBP, emptyBP)
      elemMap = getElemMap(await workspace.elements)
    })

    it('should add new blueprints', async () => {
      expect(_.keys(await workspace.parsedBlueprints)).toContain('new.bp')
    })
    it('should add new elements', () => {
      expect(elemMap).toHaveProperty(['salesforce.new'])
    })
    it('should update elements', () => {
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(lead.fields.new_base).toBeDefined()
      expect(lead.fields.base_field).not.toBeDefined()
    })
    it('should remove empty blueprints', async () => {
      expect(_.keys(await workspace.parsedBlueprints)).not.toContain('willbempty.bp')
    })

    it('should create blueprints that were added', async () => {
      const mockSetBpStore = bpStore.set as jest.Mock
      expect(mockSetBpStore).toHaveBeenCalledWith(newBP)
    })

    it('should change the content of blueprints that were updated', async () => {
      const mockSetBpStore = bpStore.set as jest.Mock
      expect(mockSetBpStore).toHaveBeenCalledWith(changedBP)
    })
  })

  describe('updateBlueprints', () => {
    const newElemID = new ElemID('salesforce', 'new_elem')
    const newElem = new ObjectType({
      elemID: newElemID,
      path: ['test', 'new'],
    })
    const oldField = new Field(
      new ElemID('salesforce', 'lead'),
      'not_a_list_yet_field',
      BuiltinTypes.NUMBER,
      {},
      false
    )
    const newField = oldField.clone()
    newField.isList = true
    const anotherNewField = new Field(
      new ElemID('salesforce', 'lead'),
      'lala',
      BuiltinTypes.NUMBER,
      {},
      false
    )

    const changes: DetailedChange[] = [
      { // modify value
        id: new ElemID('salesforce', 'lead', 'field', 'base_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'modify',
        data: { before: 'asd', after: 'foo' },
      },
      { // add element (top level)
        id: newElemID,
        action: 'add',
        data: { after: newElem },
      },
      { // add complex value (nested in parent scope)
        id: new ElemID('salesforce', 'lead', 'field', 'base_field', 'complex'),
        action: 'add',
        data: { after: { key: 'value' } },
      },
      { // remove value
        id: new ElemID('salesforce', 'lead', 'field', 'ext_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'remove',
        data: { before: 'foo' },
      },
      // TODO: figure if it's ok to mark this
      // { // Add value to empty scope
      //  id: new ElemID('external', 'file', 'attr', CORE_ANNOTATIONS.DEFAULT),
      //  action: 'add',
      //  data: { after: 'some value' },
      // },
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
        id: new ElemID('salesforce', 'lead', 'field', 'list_field', CORE_ANNOTATIONS.DEFAULT, '3'),
        action: 'modify',
        data: { before: 4, after: 5 },
      },
      { // Modify field isListValue
        id: newField.elemID,
        action: 'modify',
        data: { before: oldField, after: newField },
      },
      {
        path: ['other', 'bar'],
        id: anotherNewField.elemID,
        action: 'add',
        data: { after: anotherNewField },

      },
      {
        path: ['other', 'battr'],
        id: new ElemID('salesforce', 'lead', 'attr', 'bobo'),
        action: 'add',
        data: { after: 'baba' },

      },
      {
        path: ['other', 'boo'],
        id: new ElemID('salesforce', 'lead', 'attr', 'nono'),
        action: 'add',
        data: { after: 'nono' },
      },
      {
        path: ['other', 'boo'],
        id: new ElemID('salesforce', 'lead', 'attr', 'momo'),
        action: 'add',
        data: { after: 'momo' },
      },
      {
        path: ['other', 'foo', 'bar'],
        id: new ElemID('salesforce', 'lead', 'field', 'ext_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'add',
        data: { after: 'blublu' },
      },
      { // Add to an exiting path
        path: ['file'],
        id: new ElemID('salesforce', 'lead', 'attr', 'dodo'),
        action: 'add',
        data: { after: 'dodo' },
      },
    ]

    let lead: ObjectType
    let parsedBlueprints: ParsedBlueprintMap
    let elemMap: Record<string, Element>

    const bpStore = mockBpsStore()
    const workspace = createWorkspace(bpStore)
    beforeAll(async () => {
      await workspace.updateBlueprints(...changes)
      elemMap = getElemMap(await workspace.elements)
      parsedBlueprints = await workspace.parsedBlueprints
      lead = elemMap['salesforce.lead'] as ObjectType
    })

    it('should not cause parse errors', async () => {
      expect(await workspace.hasErrors()).toBeFalsy()
      expect((await workspace.errors).hasErrors()).toBeFalsy()
    })
    it('should modify existing element', () => {
      expect(lead).toBeDefined()
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('foo')
    })
    it('should update existing parsed blueprints content', () => {
      const setBp = bpStore.set as jest.Mock
      expect(setBp.mock.calls[0][0].buffer).toMatch(/base_field\s+{\s+_default = "foo"/s)
    })
    it('should add new element', () => {
      expect(elemMap[newElemID.getFullName()]).toBeDefined()
    })
    it('should add new blueprint', () => {
      expect(Object.keys(parsedBlueprints)).toContain('test/new.bp')
    })

    it('should add new blueprint for field with path', () => {
      expect(Object.keys(parsedBlueprints)).toContain('other/bar.bp')
      expect(parsedBlueprints['other/bar.bp'].elements[0].elemID.getFullName()).toEqual('salesforce.lead')
      expect((parsedBlueprints['other/bar.bp'].elements.filter(e => isObjectType(e))[0] as ObjectType).fields.lala).toBeDefined()
    })

    it('should add new blueprint for annotation with path', () => {
      expect(Object.keys(parsedBlueprints)).toContain('other/battr.bp')
      expect(parsedBlueprints['other/battr.bp'].elements[0].elemID.getFullName()).toEqual('salesforce.lead')
      expect((parsedBlueprints['other/battr.bp'].elements.filter(e => isObjectType(e))[0] as ObjectType).annotations.bobo).toBeDefined()
    })

    it('should add nested attributes with same parent on the same path to the same wrapper',
      async () => {
        expect(Object.keys(await workspace.parsedBlueprints)).toContain('other/boo.bp')
        expect(parsedBlueprints['other/boo.bp'].elements.length).toBe(1)
        expect(parsedBlueprints['other/boo.bp'].elements[0].annotations.nono).toBeDefined()
        expect(parsedBlueprints['other/boo.bp'].elements[0].annotations.momo).toBeDefined()
      })
    it('should add to an exiting type another nested addition', () => {
      // original file.bp had 2 elements in it
      expect(parsedBlueprints['file.bp'].elements.length).toBe(2)
      expect(parsedBlueprints['file.bp'].elements[0].annotations.dodo).toBeDefined()
    })

    it('should not add new blueprint for deeply nested type ', () => {
      expect(Object.keys(parsedBlueprints)).not.toContain('other/foo/bar.bp')
    })

    it('should add annotations under correct field', () => {
      expect(lead.fields.base_field.annotations).toHaveProperty('complex')
      expect(lead.fields.base_field.annotations.complex).toEqual({ key: 'value' })
    })
    it('should remove all definitions in remove', () => {
      expect(Object.keys(elemMap)).not.toContain('multi_loc')
    })
    it('should update value in list', () => {
      expect(lead.fields.list_field
        .annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual([1, 2, 3, 5, 5])
    })
    it('should change isList value in fields', () => {
      expect(lead.fields.not_a_list_yet_field.isList).toBe(true)
    })

    it('shouldnt fail in case one of the changes fails', async () => {
      jest.spyOn(dump, 'dump').mockImplementationOnce(() => { throw new Error('failed') })
      const realChange = _.cloneDeep(changes[0])
      _.set(realChange.data, 'after', 'blabla')
      const fakeChange = _.cloneDeep(changes[0])
      fakeChange.id = new ElemID('salesforce', 'lead').createNestedID('field', 'fake')

      await workspace.updateBlueprints(fakeChange, realChange)
      lead = findElement(await workspace.elements, new ElemID('salesforce', 'lead')) as ObjectType
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('blabla')
    })
  })

  describe('init', () => {
    const wsPath = 'test-ws-path'
    const saltoHome = 'test-home-path'
    let spyMkdir: jest.SpyInstance
    let dumpConfig: jest.SpyInstance
    beforeEach(async () => {
      process.env.SALTO_HOME = saltoHome
      spyMkdir = jest.spyOn(file, 'mkdirp').mockResolvedValue(true)
      jest.spyOn(file, 'exists').mockResolvedValue(false)
      dumpConfig = jest.spyOn(config, 'dumpConfig').mockResolvedValue()
    })

    afterEach(async () => {
      delete process.env.SALTO_HOME
    })

    it('should init a basedir with no workspace name provided', async () => {
      jest.spyOn(config, 'locateWorkspaceRoot').mockResolvedValueOnce(undefined)
      const workspace = await Workspace.init(wsPath)
      expect(dumpConfig).toHaveBeenCalled()
      expect(spyMkdir.mock.calls[0][0]).toMatch(path.join(saltoHome, wsPath))
      expect(workspace.config.name).toContain(path.basename(wsPath))
    })
    it('should init a basedir with workspace name provided', async () => {
      jest.spyOn(config, 'locateWorkspaceRoot').mockResolvedValueOnce(undefined)
      const wsName = 'test-with-name'
      const workspace = await Workspace.init(wsPath, wsName)
      expect(dumpConfig).toHaveBeenCalled()
      // TODO: need to figure why this works with wsPath and not wsName
      expect(spyMkdir.mock.calls[0][0]).toMatch(path.join(saltoHome, wsPath))
      expect(workspace.config.name).toBe(wsName)
    })
    it('should fail when run inside an existing workspace', async () => {
      jest.spyOn(config, 'locateWorkspaceRoot').mockResolvedValueOnce('found')
      await expect(Workspace.init('bla')).rejects.toThrow()
    })
    it('should parse existing bps', async () => {
      (localBpStore.localBlueprintsStore as jest.Mock).mockReturnValueOnce(mockBpsStore())
      const workspace = await Workspace.init('test')
      expect((await workspace.elements).length).toBeGreaterThan(0)
    })
  })

  describe('validation errors serverity', () => {
    const elemID = new ElemID('salesforce', 'new_elem')
    it('should be Error for reference error', () => {
      expect((new UnresolvedReferenceValidationError({
        elemID,
        ref: '',
      })).severity).toBe('Error')
    })
    it('should be Warning for other errors', () => {
      expect(new InvalidValueValidationError({
        elemID,
        value: '',
        fieldName: '',
        expectedValue: 'baba',
      }).severity).toBe('Warning')
    })
  })
})
