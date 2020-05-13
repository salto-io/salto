/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  Element, ElemID, ElementMap, Value,
} from '@salto-io/adapter-api'
import {
  resolvePath,
} from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import { mergeElements, MergeError } from '../../core/merger'
import {
  getChangeLocations, updateNaclFileData, getChangesToUpdate,
} from './nacl_file_update'
import { mergeSourceMaps, parse, SourceRange, ParseError, ParseResult } from '../../parser/parse'
import { ElementsSource } from '../elements_source'
import { ParseResultCache } from '../cache'
import { DetailedChange } from '../../core/plan'
import { DirectoryStore } from '../dir_store'
import { Errors } from '../errors'
import { StaticFilesSource } from '../static_files/common'
import { getStaticFilesFunctions } from '../static_files/functions'
import { SourceMap } from '../../parser/internal/source_map'

const { withLimitedConcurrency } = promises.array

const log = logger(module)

export type RoutingMode = 'isolated' | 'default'

export const FILE_EXTENSION = '.nacl'
const PARSE_CONCURRENCY = 20
const DUMP_CONCURRENCY = 20
// TODO: this should moved into cache implemenation
const CACHE_READ_CONCURRENCY = 20

export type NaclFile = {
  buffer: string
  filename: string
  timestamp?: number
}

export type NaclFilesSource = ElementsSource & {
  updateNaclFiles: (changes: DetailedChange[], mode?: RoutingMode) => Promise<void>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
  // TODO: this should be for single?
  setNaclFiles: (...naclFiles: NaclFile[]) => Promise<void>
  removeNaclFiles: (...names: string[]) => Promise<void>
  getSourceMap: (filename: string) => Promise<SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<SourceRange[]>
  getErrors: () => Promise<Errors>
  getElements: (filename: string) => Promise<Element[]>
  clone: () => NaclFilesSource
}

type ParsedNaclFile = {
  filename: string
  elements: ElementMap
  errors: ParseError[]
  timestamp: number
}

type ParsedNaclFileMap = {
  [key: string]: ParsedNaclFile
}

type NaclFilesState = {
  readonly ParsedNaclFiles: ParsedNaclFileMap
  readonly elementsIndex: Record<string, string[]>
  readonly mergedElements: Record<string, Element>
  readonly mergeErrors: MergeError[]
}

const buildNaclFilesSource = (
  naclFilesStore: DirectoryStore,
  cache: ParseResultCache,
  staticFileSource: StaticFilesSource,
  initState?: Promise<NaclFilesState>
): NaclFilesSource => {
  const functions: Functions = {
    ...getStaticFilesFunctions(staticFileSource), // add future functions here
  }
  const parseNaclFile = async (naclFile: NaclFile): Promise<ParseResult> => {
    const key = { filename: naclFile.filename, lastModified: naclFile.timestamp || Date.now() }
    let parseResult = await cache.get(key)
    if (parseResult === undefined) {
      parseResult = await parse(
        Buffer.from(naclFile.buffer), naclFile.filename,
        functions,
      )
      await cache.put(key, parseResult)
    }
    return parseResult
  }

  const parseNaclFiles = async (naclFiles: NaclFile[]): Promise<ParsedNaclFile[]> =>
    withLimitedConcurrency(naclFiles.map(naclFile => async () => {
      const parsed = await parseNaclFile(naclFile)
      return {
        timestamp: naclFile.timestamp || Date.now(),
        filename: naclFile.filename,
        elements: _.keyBy(parsed.elements, e => e.elemID.getFullName()),
        errors: parsed.errors,
      }
    }), PARSE_CONCURRENCY)

  const readAllNaclFiles = async (): Promise<NaclFile[]> =>
    _.reject(
      await naclFilesStore.getFiles(await naclFilesStore.list()),
      _.isUndefined
    ) as NaclFile[]

  const buildNaclFilesState = async (newNaclFiles: NaclFile[], current: ParsedNaclFileMap):
    Promise<NaclFilesState> => {
    log.debug(`going to parse ${newNaclFiles.length} NaCl files`)
    const ParsedNaclFiles = await parseNaclFiles(newNaclFiles)
    const newParsed = _.keyBy(ParsedNaclFiles, parsed => parsed.filename)
    const allParsed = _.omitBy({ ...current, ...newParsed },
      parsed => (_.isEmpty(parsed.elements) && _.isEmpty(parsed.errors)))

    const elementsIndex: Record<string, string[]> = {}
    Object.values(allParsed).forEach(naclFile => Object.keys(naclFile.elements)
      .forEach(key => {
        elementsIndex[key] = elementsIndex[key] || []
        elementsIndex[key] = _.uniq([...elementsIndex[key], naclFile.filename])
      }))

    const mergeResult = mergeElements(
      _.flatten(Object.values(allParsed).map(parsed => Object.values(parsed.elements)))
    )

    log.info('workspace has %d elements and %d parsed NaCl files',
      _.size(elementsIndex), _.size(allParsed))
    return {
      ParsedNaclFiles: allParsed,
      mergedElements: _.keyBy(mergeResult.merged, e => e.elemID.getFullName()),
      mergeErrors: mergeResult.errors,
      elementsIndex,
    }
  }

  let state = initState
  const getState = (): Promise<NaclFilesState> => {
    if (_.isUndefined(state)) {
      state = readAllNaclFiles().then(naclFiles => buildNaclFilesState(naclFiles, {}))
    }
    return state
  }

  const getElementNaclFiles = async (elemID: ElemID): Promise<string[]> => {
    const topLevelID = elemID.createTopLevelParentID()
    return (await getState()).elementsIndex[topLevelID.parent.getFullName()] || []
  }

  const getSourceMap = async (filename: string): Promise<SourceMap> => {
    const parsedNaclFile = (await getState()).ParsedNaclFiles[filename]
    const cachedParsedResult = await cache.get({ filename, lastModified: parsedNaclFile.timestamp })
    if (_.isUndefined(cachedParsedResult)) {
      log.warn('expected to find source map for filename %s, going to re-parse', filename)
      const buffer = (await naclFilesStore.get(filename))?.buffer
      if (_.isUndefined(buffer)) {
        log.error('failed to find %s in NaCl file store', filename)
        return new SourceMap()
      }
      return (await parseNaclFile({ filename, buffer })).sourceMap
    }

    return cachedParsedResult.sourceMap
  }

  const setNaclFiles = async (...naclFiles: NaclFile[]): Promise<void> => {
    const [emptyNaclFiles, nonEmptyNaclFiles] = _.partition(
      naclFiles,
      naclFile => _.isEmpty(naclFile.buffer.trim())
    )
    await Promise.all(nonEmptyNaclFiles.map(naclFile => naclFilesStore.set(naclFile)))
    await Promise.all(emptyNaclFiles.map(naclFile => naclFilesStore.delete(naclFile.filename)))
    // Swap state
    state = buildNaclFilesState(naclFiles, (await getState()).ParsedNaclFiles)
  }

  const updateNaclFiles = async (changes: DetailedChange[]): Promise<void> => {
    const getNaclFileData = async (filename: string): Promise<string> => {
      const naclFile = await naclFilesStore.get(filename)
      return naclFile ? naclFile.buffer : ''
    }

    const naclFiles = _(await Promise.all(changes
      .map(change => change.id)
      .map(elemID => getElementNaclFiles(elemID))))
      .flatten().uniq().value()
    const { ParsedNaclFiles } = await getState()
    const changedFileToSourceMap: Record<string, SourceMap> = _.fromPairs(
      await withLimitedConcurrency(naclFiles
        .map(naclFile => async () => [ParsedNaclFiles[naclFile].filename,
          await getSourceMap(ParsedNaclFiles[naclFile].filename)]),
      CACHE_READ_CONCURRENCY)
    )
    const mergedSourceMap = mergeSourceMaps(Object.values(changedFileToSourceMap))
    const changesToUpdate = getChangesToUpdate(changes, mergedSourceMap)
    const updatedNaclFiles = (await withLimitedConcurrency(
      _(changesToUpdate)
        .map(change => getChangeLocations(change, mergedSourceMap))
        .flatten()
        .groupBy(change => change.location.filename)
        .entries()
        .map(([filename, fileChanges]) => async () => {
          try {
            const buffer = await updateNaclFileData(await getNaclFileData(filename),
              fileChanges, functions)
            return { filename, buffer }
          } catch (e) {
            log.error('failed to update NaCl file %s with %o changes due to: %o',
              filename, fileChanges, e)
            return undefined
          }
        })
        .value(),
      DUMP_CONCURRENCY
    )).filter(b => b !== undefined) as NaclFile[]

    if (updatedNaclFiles.length > 0) {
      log.debug('going to update %d NaCl files', updatedNaclFiles.length)
      await setNaclFiles(...updatedNaclFiles)
    }
  }

  return {
    list: async (): Promise<ElemID[]> =>
      Object.keys((await getState()).elementsIndex).map(name => ElemID.fromFullName(name)),

    get: async (id: ElemID): Promise<Element | Value> => {
      const currentState = await getState()
      const { parent, path } = id.createTopLevelParentID()
      const baseElement = currentState.mergedElements[parent.getFullName()]
      return baseElement && !_.isEmpty(path) ? resolvePath(baseElement, id) : baseElement
    },

    getAll: async (): Promise<Element[]> => _.values((await getState()).mergedElements),

    flush: async (): Promise<void> => {
      await naclFilesStore.flush()
      await cache.flush()
      await staticFileSource.flush()
    },

    getErrors: async (): Promise<Errors> => {
      const currentState = await getState()
      return new Errors({
        parse: _.flatten(Object.values(currentState.ParsedNaclFiles).map(parsed => parsed.errors)),
        merge: currentState.mergeErrors,
        validation: [],
      })
    },

    listNaclFiles: () => naclFilesStore.list(),

    getTotalSize: async (): Promise<number> =>
      _.sum(await Promise.all([naclFilesStore.getTotalSize(), staticFileSource.getTotalSize()])),

    getNaclFile: filename => naclFilesStore.get(filename),

    getElements: async filename =>
      Object.values((await getState()).ParsedNaclFiles[filename]?.elements) || [],

    getSourceRanges: async elemID => {
      const naclFiles = await getElementNaclFiles(elemID)
      const sourceRanges = await withLimitedConcurrency(naclFiles
        .map(naclFile => async () => (await getSourceMap(naclFile))
          .get(elemID.getFullName()) || []),
      CACHE_READ_CONCURRENCY)
      return _.flatten(sourceRanges)
    },

    removeNaclFiles: async (...names: string[]) => {
      await Promise.all(names.map(name => naclFilesStore.delete(name)))
      state = buildNaclFilesState(names
        .map(filename => ({ filename, buffer: '' })), (await getState()).ParsedNaclFiles)
    },

    clear: async () => {
      // The order is important
      await staticFileSource.clear()
      await naclFilesStore.clear()
      await cache.clear()
    },

    rename: async (name: string) => {
      await naclFilesStore.rename(name)
      await staticFileSource.rename(name)
      await cache.rename(name)
    },

    clone: () => buildNaclFilesSource(
      naclFilesStore.clone(),
      cache.clone(),
      staticFileSource.clone(),
      state,
    ),

    updateNaclFiles,
    setNaclFiles,
    getSourceMap,
    getElementNaclFiles,
  }
}

export const naclFilesSource = (
  naclFilesStore: DirectoryStore,
  cache: ParseResultCache,
  staticFileSource: StaticFilesSource,
): NaclFilesSource => buildNaclFilesSource(naclFilesStore, cache, staticFileSource)
