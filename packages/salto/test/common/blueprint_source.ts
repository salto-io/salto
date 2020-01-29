import { ElemID, Element } from 'adapter-api'
import _ from 'lodash'
import { BlueprintsSource } from '../../src/workspace/blueprints/blueprints_source'

export const createMockBlueprintSource = (elements: Element[]): BlueprintsSource => ({
  list: async () => elements.map(e => e.elemID),
  get: async (id: ElemID) => elements.find(e => _.isEqual(id, e.elemID)),
  getAll: async () => elements,
  flush: jest.fn().mockImplementation(() => Promise.resolve()),
  update: jest.fn().mockImplementation(() => Promise.resolve()),
  listBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  getBlueprint: jest.fn().mockImplementation(() => Promise.resolve()),
  setBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  removeBlueprints: jest.fn().mockImplementation(() => Promise.resolve()),
  getSourceMap: jest.fn().mockImplementation(() => Promise.resolve()),
  getSourceRanges: jest.fn().mockImplementation(() => Promise.resolve()),
  getErrors: jest.fn().mockImplementation(() => Promise.resolve()),
  getElements: jest.fn().mockImplementation(() => Promise.resolve()),
})
