import _ from 'lodash'
import { logger } from '@salto/logging'
import { Element, ElemID, ElementMap } from 'adapter-api'
import { mergeElements, MergeError } from '../../core/merger'
import { getChangeLocations, updateBlueprintData, getChangesToUpdate } from './blueprint_update'
import { mergeSourceMaps, SourceMap, parse, SourceRange, ParseError, ParseResult } from '../../parser/parse'
import { ElementsSource } from '../elements_source'
import { ParseResultCache } from '../cache'
import { DetailedChange } from '../../core/plan'
import { DirectoryStore } from '../dir_store'
import { Errors } from '../errors'

const log = logger(module)

export const BP_EXTENSION = '.bp'

export type Blueprint = {
  buffer: string
  filename: string
  timestamp?: number
}

export type BlueprintsSource = ElementsSource & {
  update: (changes: DetailedChange[]) => Promise<void>
  listBlueprints: () => Promise<string[]>
  getBlueprint: (filename: string) => Promise<Blueprint | undefined>
  // TODO: this should be for single?
  setBlueprints: (...blueprints: Blueprint[]) => Promise<void>
  removeBlueprints: (...names: string[]) => Promise<void>
  getSourceMap: (filename: string) => Promise<SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<SourceRange[]>
  getErrors: () => Promise<Errors>
  getElements: (filename: string) => Promise<Element[]>
}

type ParsedBlueprint = {
  filename: string
  elements: ElementMap
  errors: ParseError[]
  timestamp: number
}

type ParsedBlueprintMap = {
  [key: string]: ParsedBlueprint
}

export type BlueprintsState = {
  readonly parsedBlueprints: ParsedBlueprintMap
  readonly elementsIndex: Record<string, string[]>
  readonly elements: Record<string, Element>
  readonly errors: MergeError[]

}

export const blueprintsSource = (blueprintsStore: DirectoryStore, cache: ParseResultCache):
BlueprintsSource => {
  const parseBlueprint = async (bp: Blueprint): Promise<ParseResult> => {
    const key = { filename: bp.filename, lastModified: bp.timestamp || Date.now() }
    let parseResult = await cache.get(key)
    if (parseResult === undefined) {
      parseResult = parse(Buffer.from(bp.buffer), bp.filename)
      await cache.put(key, parseResult)
    }
    return parseResult
  }

  const parseBlueprints = async (blueprints: Blueprint[]): Promise<ParsedBlueprint[]> =>
    Promise.all(blueprints.map(async bp => {
      const parsed = await parseBlueprint(bp)
      return {
        timestamp: bp.timestamp || Date.now(),
        filename: bp.filename,
        elements: _.keyBy(parsed.elements, e => e.elemID.getFullName()),
        errors: parsed.errors,
      }
    }))

  const readAllBps = async (): Promise<Blueprint[]> => (
    Promise.all((await blueprintsStore.list())
      .map(async filename => blueprintsStore.get(filename))) as Promise<Blueprint[]>
  )

  const buildBlueprintsState = async (newBps: Blueprint[], current: ParsedBlueprintMap):
    Promise<BlueprintsState> => {
    log.debug(`going to parse ${newBps.length} blueprints`)
    const parsedBlueprints = await parseBlueprints(newBps)
    const newParsed = _.keyBy(parsedBlueprints, parsed => parsed.filename)
    const allParsed = _.omitBy({ ...current, ...newParsed },
      parsed => (_.isEmpty(parsed.elements) && _.isEmpty(parsed.errors)))

    const elementsIndex: Record<string, string[]> = {}
    Object.values(allParsed).forEach(bp => Object.keys(bp.elements)
      .forEach(key => {
        elementsIndex[key] = elementsIndex[key] || []
        elementsIndex[key] = _.uniq([...elementsIndex[key], bp.filename])
      }))

    const mergeResult = mergeElements(
      _.flatten(Object.values(allParsed).map(parsed => Object.values(parsed.elements)))
    )

    log.info('workspace has %d elements and %d parsed blueprints',
      _.size(elementsIndex), _.size(allParsed))
    return {
      parsedBlueprints: allParsed,
      elements: _.keyBy(mergeResult.merged, e => e.elemID.getFullName()),
      errors: mergeResult.errors,
      elementsIndex,
    }
  }

  let state: Promise<BlueprintsState> = readAllBps()
    .then(bps => buildBlueprintsState(bps, {}))

  const getElementBlueprints = async (elemID: ElemID): Promise<string[]> => {
    const topLevelID = elemID.createTopLevelParentID()
    return (await state).elementsIndex[topLevelID.parent.getFullName()] || []
  }

  const getSourceMap = async (filename: string): Promise<SourceMap> => {
    const parsedBp = (await state).parsedBlueprints[filename]
    const cachedParsedResult = await cache.get({ filename, lastModified: parsedBp.timestamp })
    if (_.isUndefined(cachedParsedResult)) {
      log.warn('expected to find source map for filename %s, going to re-parse', filename)
      const buffer = (await blueprintsStore.get(filename))?.buffer
      if (_.isUndefined(buffer)) {
        log.error('failed to find %s in blueprint store', filename)
        return new Map<string, SourceRange[]>()
      }
      return (await parseBlueprint({ filename, buffer })).sourceMap
    }
    return cachedParsedResult.sourceMap
  }

  const setBlueprints = async (...blueprints: Blueprint[]): Promise<void> => {
    await Promise.all(blueprints.map(bp => blueprintsStore.set(bp)))
    // Swap state
    state = buildBlueprintsState(blueprints, (await state).parsedBlueprints)
  }

  const update = async (changes: DetailedChange[]): Promise<void> => {
    const getBlueprintData = async (filename: string): Promise<string> => {
      const bp = await blueprintsStore.get(filename)
      return bp ? bp.buffer : ''
    }

    log.debug('going to calculate new blueprints data')
    const changesToUpdate = getChangesToUpdate(changes, (await state).elementsIndex)
    const bps = _(await Promise.all(changesToUpdate
      .map(change => change.id)
      .map(elemID => getElementBlueprints(elemID))))
      .flatten().uniq().value()
    const { parsedBlueprints } = await state
    const changeSourceMaps = await Promise.all(bps
      .map(bp => getSourceMap(parsedBlueprints[bp].filename)))

    const mergedSourceMap = mergeSourceMaps(changeSourceMaps)
    const updatedBlueprints = (await Promise.all(
      _(changesToUpdate)
        .map(change => getChangeLocations(change, mergedSourceMap))
        .flatten()
        .groupBy(change => change.location.filename)
        .entries()
        .map(async ([filename, fileChanges]) => {
          try {
            const buffer = updateBlueprintData(await getBlueprintData(filename), fileChanges)
            return { filename, buffer }
          } catch (e) {
            log.error('failed to update blueprint %s with %o changes due to: %o',
              filename, fileChanges, e)
            return undefined
          }
        })
        .value()
    )).filter(b => b !== undefined) as Blueprint[]

    log.debug('going to set the new blueprints')
    return setBlueprints(...updatedBlueprints)
  }

  return {
    list: async (): Promise<ElemID[]> =>
      Object.keys((await state).elementsIndex).map(name => ElemID.fromFullName(name)),

    get: async (id: ElemID): Promise<Element> => {
      const currentState = await state
      return currentState.elements[id.getFullName()]
    },

    getAll: async (): Promise<Element[]> => _.values((await state).elements),

    flush: async (): Promise<void> => {
      await blueprintsStore.flush()
      await cache.flush()
    },

    getErrors: async (): Promise<Errors> => new Errors({
      parse: _.flatten(Object.values((await state).parsedBlueprints).map(parsed => parsed.errors)),
      merge: (await state).errors,
      validation: [],
    }),

    listBlueprints: () => blueprintsStore.list(),

    getBlueprint: filename => blueprintsStore.get(filename),

    getElements: async filename =>
      Object.values((await state).parsedBlueprints[filename]?.elements) || [],

    getSourceRanges: async elemID => {
      const bps = await getElementBlueprints(elemID)
      const sourceRanges = await Promise.all(bps
        .map(async bp => (await getSourceMap(bp)).get(elemID.getFullName()) || []))
      return _.flatten(sourceRanges)
    },

    removeBlueprints: async (...names: string[]) => {
      await Promise.all(names.map(name => blueprintsStore.delete(name)))
      state = buildBlueprintsState(names
        .map(filename => ({ filename, buffer: '' })), (await state).parsedBlueprints)
    },

    update,
    setBlueprints,
    getSourceMap,
  }
}
