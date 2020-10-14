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
  Element, ElemID, Value, DetailedChange, isElement, getChangeElement,
} from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { promises, values } from '@salto-io/lowerdash'
import { AdditionDiff } from '@salto-io/dag'
import { mergeElements, MergeError } from '../../merger'
import {
  getChangeLocations, updateNaclFileData, getChangesToUpdate, DetailedChangeWithSource,
  getNestedStaticFiles,
} from './nacl_file_update'
import { parse, SourceRange, ParseError, ParseResult, SourceMap } from '../../parser'
import { ElementsSource } from '../elements_source'
import { ParseResultCache, ParseResultKey } from '../cache'
import { DirectoryStore } from '../dir_store'
import { Errors } from '../errors'
import { StaticFilesSource } from '../static_files'
import { getStaticFilesFunctions } from '../static_files/functions'

import { Functions } from '../../parser/functions'

const { withLimitedConcurrency } = promises.array

const log = logger(module)

export type RoutingMode = 'isolated' | 'default' | 'align' | 'override'

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

export type NaclFilesSource = Omit<ElementsSource, 'clear'> & {
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
  getParsedNaclFile: (filename: string) => Promise<ParsedNaclFile | undefined>
  clone: () => NaclFilesSource
  isEmpty: () => Promise<boolean>
  clear(args?: {
    nacl?: boolean
    staticResources?: boolean
    cache?: boolean
  }): Promise<void>
}

export type ParsedNaclFile = {
  filename: string
  elements: Element[]
  errors: ParseError[]
  timestamp: number
  buffer?: string
}

type ParsedNaclFileMap = {
  [key: string]: ParsedNaclFile
}

type NaclFilesState = {
  readonly parsedNaclFiles: ParsedNaclFileMap
  readonly elementsIndex: Record<string, string[]>
  readonly mergedElements: Record<string, Element>
  readonly mergeErrors: MergeError[]
}

const cacheResultKey = (filename: string, timestamp?: number): ParseResultKey => ({
  filename,
  lastModified: timestamp ?? Date.now(),
})

const toParsedNaclFile = (
  naclFile: NaclFile,
  parseResult: ParseResult
): ParsedNaclFile => ({
  timestamp: naclFile.timestamp || Date.now(),
  filename: naclFile.filename,
  elements: parseResult.elements,
  errors: parseResult.errors,
})

const parseNaclFile = async (
  naclFile: NaclFile, cache: ParseResultCache, functions: Functions
): Promise<Required<ParseResult>> => {
  const parseResult = await parse(Buffer.from(naclFile.buffer), naclFile.filename, functions)
  const key = cacheResultKey(naclFile.filename)
  await cache.put(key, parseResult)
  return parseResult
}

const parseNaclFiles = async (
  naclFiles: NaclFile[], cache: ParseResultCache, functions: Functions
): Promise<ParsedNaclFile[]> =>
  withLimitedConcurrency(naclFiles.map(naclFile => async () => {
    const key = cacheResultKey(naclFile.filename, naclFile.timestamp)
    const cachedResult = await cache.get(key)
    return cachedResult
      ? toParsedNaclFile(naclFile, cachedResult)
      : toParsedNaclFile(naclFile, await parseNaclFile(naclFile, cache, functions))
  }), PARSE_CONCURRENCY)

export const getFunctions = (staticFileSource: StaticFilesSource): Functions => ({
  ...getStaticFilesFunctions(staticFileSource), // add future functions here
})

export const getParsedNaclFiles = async (
  naclFilesStore: DirectoryStore<string>,
  cache: ParseResultCache,
  staticFileSource: StaticFilesSource
): Promise<ParsedNaclFile[]> => {
  const naclFiles = (await naclFilesStore.getFiles(await naclFilesStore.list()))
    .filter(values.isDefined)
  const functions = getFunctions(staticFileSource)
  return parseNaclFiles(naclFiles, cache, functions)
}

const buildNaclFilesState = async (newNaclFiles: ParsedNaclFile[], current?: ParsedNaclFileMap):
Promise<NaclFilesState> => {
  log.debug(`going to parse ${newNaclFiles.length} NaCl files`)
  const newParsed = _.keyBy(newNaclFiles, parsed => parsed.filename)
  const allParsed = _.omitBy({ ...current, ...newParsed },
    parsed => (_.isEmpty(parsed.elements) && _.isEmpty(parsed.errors)))

  const elementsIndex: Record<string, string[]> = {}
  Object.values(allParsed).forEach(naclFile =>
    naclFile.elements.forEach(element => {
      const elementFullName = element.elemID.getFullName()
      elementsIndex[elementFullName] = elementsIndex[elementFullName] || []
      elementsIndex[elementFullName] = _.uniq(
        [...elementsIndex[elementFullName], naclFile.filename]
      )
    }))

  const mergeResult = mergeElements(
    Object.values(allParsed).flatMap(parsed => parsed.elements)
  )

  log.info('workspace has %d elements and %d parsed NaCl files',
    _.size(elementsIndex), _.size(allParsed))
  return {
    parsedNaclFiles: allParsed,
    mergedElements: _.keyBy(mergeResult.merged, e => e.elemID.getFullName()),
    mergeErrors: mergeResult.errors,
    elementsIndex,
  }
}

const logNaclFileUpdateErrorContext = (
  filename: string,
  fileChanges: DetailedChangeWithSource[],
  naclDataBefore: string,
  naclDataAfter: string,
): void => {
  log.debug('Parse errors in file %s after updating with changes:', filename)
  fileChanges.forEach(change => {
    log.debug(
      '%s of %s at location: (start=%o end=%o)',
      change.action,
      change.id.getFullName(),
      change.location.start,
      change.location.end,
    )
  })
  log.debug('data before:\n%s', naclDataBefore)
  log.debug('data after:\n%s', naclDataAfter)
}

const buildNaclFilesSource = (
  naclFilesStore: DirectoryStore<string>,
  cache: ParseResultCache,
  staticFileSource: StaticFilesSource,
  initState?: Promise<NaclFilesState>
): NaclFilesSource => {
  const functions: Functions = getFunctions(staticFileSource)

  const createNaclFileFromChange = async (
    filename: string,
    change: AdditionDiff<Element>,
  ): Promise<ParsedNaclFile> => {
    const elements = [(change as AdditionDiff<Element>).data.after]
    const parsed = {
      timestamp: Date.now(),
      filename,
      elements,
      errors: [],
    }
    const key = cacheResultKey(parsed.filename, parsed.timestamp)
    await cache.put(key, { elements, errors: [] })
    return parsed
  }

  let state = initState
  const getState = (): Promise<NaclFilesState> => {
    if (_.isUndefined(state)) {
      state = getParsedNaclFiles(naclFilesStore, cache, staticFileSource)
        .then(parsedFiles => buildNaclFilesState(parsedFiles, {}))
    }
    return state
  }

  const getElementNaclFiles = async (elemID: ElemID): Promise<string[]> => {
    const topLevelID = elemID.createTopLevelParentID()
    return (await getState()).elementsIndex[topLevelID.parent.getFullName()] || []
  }

  const getSourceMap = async (filename: string): Promise<SourceMap> => {
    const parsedNaclFile = (await getState()).parsedNaclFiles[filename]
    const key = cacheResultKey(parsedNaclFile.filename, parsedNaclFile.timestamp)
    const cachedResult = await cache.get(key)
    if (cachedResult && cachedResult.sourceMap) {
      return cachedResult.sourceMap
    }
    const naclFile = (await naclFilesStore.get(filename))
    if (_.isUndefined(naclFile)) {
      log.error('failed to find %s in NaCl file store', filename)
      return new SourceMap()
    }
    const parsedResult = await parseNaclFile(naclFile, cache, functions)
    return parsedResult.sourceMap
  }

  const setNaclFiles = async (
    ...naclFiles: NaclFile[]
  ): Promise<void> => {
    const [emptyNaclFiles, nonEmptyNaclFiles] = _.partition(
      naclFiles,
      naclFile => _.isEmpty(naclFile.buffer.trim())
    )
    await Promise.all(nonEmptyNaclFiles.map(naclFile => naclFilesStore.set(naclFile)))
    await Promise.all(emptyNaclFiles.map(naclFile => naclFilesStore.delete(naclFile.filename)))
  }

  const updateNaclFiles = async (changes: DetailedChange[]): Promise<void> => {
    const getNaclFileData = async (filename: string): Promise<string> => {
      const naclFile = await naclFilesStore.get(filename)
      return naclFile ? naclFile.buffer : ''
    }

    // This method was written with the assumption that each static file is pointed by no more
    // then one value inthe nacls. A ticket was open to fix that (SALTO-954)

    const removeDanglingStaticFiles = async (fileChanges: DetailedChange[]): Promise<void> => {
      await Promise.all(fileChanges.filter(change => change.action === 'remove')
        .map(getChangeElement)
        .map(getNestedStaticFiles)
        .flatMap(files => files.map(file => staticFileSource.delete(file))))
    }

    const naclFiles = _(await Promise.all(changes.map(change => change.id)
      .map(elemID => getElementNaclFiles(elemID))))
      .flatten().uniq().value()
    const { parsedNaclFiles } = await getState()
    const changedFileToSourceMap: Record<string, SourceMap> = _.fromPairs(
      await withLimitedConcurrency(naclFiles
        .map(naclFile => async () => [parsedNaclFiles[naclFile].filename,
          await getSourceMap(parsedNaclFiles[naclFile].filename)]),
      CACHE_READ_CONCURRENCY)
    )
    const mergedSourceMap = Object.values(changedFileToSourceMap).reduce((acc, sourceMap) => {
      acc.merge(sourceMap)
      return acc
    }, new SourceMap())

    const changesToUpdate = getChangesToUpdate(changes, mergedSourceMap)
    const updatedNaclFiles = (await withLimitedConcurrency(
      _(changesToUpdate)
        .map(change => getChangeLocations(change, mergedSourceMap))
        .flatten()
        .groupBy(change => change.location.filename)
        .entries()
        .map(([filename, fileChanges]) => async () => {
          try {
            const naclFileData = await getNaclFileData(filename)
            const buffer = await updateNaclFileData(naclFileData, fileChanges, functions)
            const shouldNotParse = _.isEmpty(naclFileData)
              && fileChanges.length === 1
              && fileChanges[0].action === 'add'
              && isElement(fileChanges[0].data.after)
            const parsed = shouldNotParse
              ? await createNaclFileFromChange(filename, fileChanges[0] as AdditionDiff<Element>)
              : toParsedNaclFile({ filename, buffer },
                await parseNaclFile({ filename, buffer }, cache, functions))
            if (parsed.errors.length > 0) {
              logNaclFileUpdateErrorContext(filename, fileChanges, naclFileData, buffer)
            }
            await removeDanglingStaticFiles(fileChanges)
            return { ...parsed, buffer }
          } catch (e) {
            log.error('failed to update NaCl file %s with %o changes due to: %o',
              filename, fileChanges, e)
            return undefined
          }
        })
        .value(),
      DUMP_CONCURRENCY
    )).filter(b => b !== undefined) as Required<ParsedNaclFile>[]

    if (updatedNaclFiles.length > 0) {
      log.debug('going to update %d NaCl files', updatedNaclFiles.length)
      await setNaclFiles(...updatedNaclFiles)
      state = buildNaclFilesState(
        updatedNaclFiles,
        (await getState()).parsedNaclFiles
      )
    }
  }
  const getNaclFile = (filename: string): Promise<NaclFile | undefined> =>
    naclFilesStore.get(filename)

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
        parse: _.flatten(Object.values(currentState.parsedNaclFiles).map(parsed => parsed.errors)),
        merge: currentState.mergeErrors,
        validation: [],
      })
    },

    listNaclFiles: async (): Promise<string[]> => Object.keys((await getState()).parsedNaclFiles),

    getTotalSize: async (): Promise<number> =>
      _.sum(await Promise.all([naclFilesStore.getTotalSize(), staticFileSource.getTotalSize()])),

    getNaclFile,

    getParsedNaclFile: async filename => {
      // We don't want to parse all nacl files here when we want only parsedResult of one file.
      if (state !== undefined) {
        return (await getState()).parsedNaclFiles[filename]
      }
      const naclFile = await getNaclFile(filename)
      if (naclFile === undefined) return undefined
      return (await parseNaclFiles([naclFile], cache, functions))[0]
    },

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
      state = buildNaclFilesState(
        await parseNaclFiles(names.map(filename => ({ filename, buffer: '' })), cache, functions),
        (await getState()).parsedNaclFiles
      )
    },

    clear: async (args = { nacl: true, staticResources: true, cache: true }) => {
      if (args.staticResources && !(args.cache && args.nacl)) {
        throw new Error('Cannot clear static resources without clearing the cache and nacls')
      }

      // The order is important
      if (args.staticResources) {
        await staticFileSource.clear()
      }
      if (args.nacl) {
        await naclFilesStore.clear()
      }
      if (args.cache) {
        await cache.clear()
      }
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
    setNaclFiles: async (...naclFiles) => {
      await setNaclFiles(...naclFiles)
      state = buildNaclFilesState(
        await parseNaclFiles(naclFiles, cache, functions),
        (await getState()).parsedNaclFiles
      )
    },
    getSourceMap,
    getElementNaclFiles,
    isEmpty: () => naclFilesStore.isEmpty(),
  }
}

export const naclFilesSource = (
  naclFilesStore: DirectoryStore<string>,
  cache: ParseResultCache,
  staticFileSource: StaticFilesSource,
  parsedFiles?: ParsedNaclFile[],
): NaclFilesSource => {
  const state = (parsedFiles !== undefined) ? buildNaclFilesState(parsedFiles, {}) : undefined
  return buildNaclFilesSource(naclFilesStore, cache, staticFileSource, state)
}
