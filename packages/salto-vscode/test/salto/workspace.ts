import * as path from 'path'
import { Config, Workspace, parse, file, SourceRange, ParsedBlueprint } from 'salto'
import { InstanceElement, ElemID, ObjectType, Field, BuiltinTypes } from 'adapter-api'
import _ from 'lodash'
import { ParseError } from 'salto/dist/src/parser/parse'
import { mergeElements } from 'salto/dist/src/core/merger'

const SERVICES = ['salesforce']

const configID = new ElemID(SERVICES[0])
const mockConfigType = new ObjectType({
  elemID: configID,
  fields: {
    username: new Field(configID, 'username', BuiltinTypes.STRING),
  },
})
const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
})
export const mockWorkspace = async (blueprint?: string, config?: Partial<Config>
): Promise<Workspace> => {
  const baseDir = blueprint ? path.dirname(blueprint) : 'default_base_dir'
  const filename = blueprint ? path.relative(baseDir, blueprint) : 'default.bp'
  const buffer = blueprint ? await file.readTextFile(blueprint) : 'blabla'
  const parseResult = blueprint
    ? parse(Buffer.from(buffer), filename)
    : { elements: [], errors: [] as ParseError[], sourceMap: { get: () => undefined } }
  const parsedBlueprint: ParsedBlueprint = {
    filename,
    elements: parseResult.elements,
    errors: parseResult.errors,
    timestamp: Date.now(),
  }
  const merged = mergeElements(parseResult.elements)
  return {
    elements: merged.merged,
    errors: {
      parse: parseResult.errors || [],
      merge: [],
      validation: [],
      hasErrors: () => (!_.isEmpty(parseResult.errors)),
    },
    parsedBlueprints: jest.fn().mockResolvedValue({ [filename]: parsedBlueprint }),
    hasErrors: jest.fn().mockImplementation(() => !_.isEmpty(parseResult.errors)),
    getSourceMap: jest.fn().mockResolvedValue(parseResult.sourceMap),
    getSourceRanges: jest.fn().mockImplementation((elemID: ElemID): SourceRange[] =>
      (parseResult.sourceMap.get(elemID.getFullName()) || [])),
    getBlueprint: jest.fn().mockResolvedValue({ filename, buffer }),
    config: _.mergeWith(config, { stateLocation: '.', services: SERVICES, baseDir }),
    updateBlueprints: jest.fn(),
    flush: jest.fn(),
    credentials: {
      get: jest.fn().mockImplementation(() => Promise.resolve(mockConfigInstance)),
      set: jest.fn().mockImplementation(() => Promise.resolve()),
    },
    getWorkspaceErrors: jest.fn().mockImplementation(() => parseResult.errors.map(e => e && {
      sourceFragments: [{ sourceRange: { filename, start: 1, end: 2 } }],
    })),
    resolveParsedBlueprint: jest.fn().mockImplementation((bp: ParsedBlueprint): Promise<unknown> =>
      (bp.filename === filename
        ? Promise.resolve({ ...parsedBlueprint, sourceMap: parseResult.sourceMap, buffer })
        : Promise.resolve(undefined))),

    setBlueprints: jest.fn().mockReturnValue(Promise.resolve()),
    removeBlueprints: jest.fn().mockReturnValue(Promise.resolve()),
    blueprintsStore: {
      list: jest.fn().mockResolvedValue([filename]),
    },
  } as unknown as Workspace
}
