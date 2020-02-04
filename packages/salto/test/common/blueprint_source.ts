import { ElemID, Element } from 'adapter-api'
import _ from 'lodash'
import { BlueprintsSource } from '../../src/workspace/blueprints/blueprints_source'
import { Errors } from '../../src/workspace/errors'
import { SourceRange } from '../../src/parser/internal/types'

export const createMockBlueprintSource = (
  elements: Element[],
  blueprints: Record<string, Element[]> = {},
  errors: Errors = new Errors({ merge: [], parse: [], validation: [] }),
  sourceRanges: SourceRange[] = []
): BlueprintsSource => ({
  list: async () => elements.map(e => e.elemID),
  get: async (id: ElemID) => elements.find(e => _.isEqual(id, e.elemID)),
  getAll: async () => elements,
  flush: jest.fn().mockImplementation(() => Promise.resolve()),
  update: jest.fn().mockImplementation(() => Promise.resolve()),
  listBlueprints: jest.fn().mockImplementation(() => Promise.resolve(_.keys(blueprints))),
  getBlueprint: jest.fn().mockImplementation(
    (filename: string) => Promise.resolve(blueprints[filename] ? { filename, buffer: '' } : undefined)
  ),
  setBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  removeBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  getSourceMap: jest.fn().mockImplementation(() => Promise.resolve()),
  getSourceRanges: jest.fn().mockImplementation(() => Promise.resolve(sourceRanges)),
  getErrors: jest.fn().mockImplementation(() => Promise.resolve(errors)),
  getElements: jest.fn().mockImplementation(
    filename => Promise.resolve(blueprints[filename] || [])
  ),
})
