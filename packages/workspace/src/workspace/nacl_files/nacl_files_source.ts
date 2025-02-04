/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  Change,
  DetailedChange,
  DetailedChangeWithBaseChange,
  Element,
  ElemID,
  isAdditionChange,
  isAdditionOrModificationChange,
  isElement,
  isModificationChange,
  isObjectTypeChange,
  isRemovalOrModificationChange,
  isStaticFile,
  StaticFile,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import {
  getRelevantNamesFromChange,
  resolvePath,
  safeJsonStringify,
  WALK_NEXT_STEP,
  walkOnElement,
  WalkOnFunc,
} from '@salto-io/adapter-utils'
import { collections, promises, values } from '@salto-io/lowerdash'
import { AdditionDiff } from '@salto-io/dag'
import { parser } from '@salto-io/parser'
import osPath from 'path'
import { mergeElements, MergeError } from '../../merger'
import {
  DetailedChangeWithSource,
  getChangeLocations,
  getChangesToUpdate,
  getNestedStaticFiles,
  updateNaclFileData,
} from './nacl_file_update'
import { ElementsSource, RemoteElementSource } from '../elements_source'
import { DirectoryStore } from '../dir_store'
import { Errors } from '../errors'
import { StaticFilesSource } from '../static_files'
import { getStaticFilesFunctions } from '../static_files/functions'
import { buildNewMergedElementsAndErrors, ChangeSet } from './elements_cache'
import { deserializeMergeErrors, deserializeSingleElement, serialize } from '../../serializer/elements'
import { RemoteMap, RemoteMapCreator } from '../remote_map'
import { ParsedNaclFile, SyncParsedNaclFile } from './parsed_nacl_file'
import { createParseResultCache, ParsedNaclFileCache } from './parsed_nacl_files_cache'
import { isInvalidStaticFile } from '../static_files/common'
import { getSaltoFlagBool, WORKSPACE_FLAGS } from '../../flags'

const { awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

const { withLimitedConcurrency } = promises.array

const log = logger(module)

export type RoutingMode = 'isolated' | 'default' | 'align' | 'override'

export const FILE_EXTENSION = '.nacl'
export const HASH_KEY = 'hash'

const PARSE_CONCURRENCY = 100
const DUMP_CONCURRENCY = 100
const SOURCE_MAP_READ_CONCURRENCY = 10
// TODO: this should moved into cache implementation
const CACHE_READ_CONCURRENCY = 100
const UPDATE_INDEX_CONCURRENCY = 100

export type NaclFile = {
  buffer: string
  filename: string
}
export type SourceLoadParams = {
  ignoreFileChanges?: boolean
}

export type NaclFilesSource<Changes = ChangeSet<Change>> = Omit<ElementsSource, 'clear'> & {
  updateNaclFiles: (changes: DetailedChangeWithBaseChange[], mode?: RoutingMode) => Promise<Changes>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
  getElementFileNames: () => Promise<Map<string, string[]>>
  // TODO: this should be for single?
  setNaclFiles: (naclFiles: NaclFile[]) => Promise<Changes>
  removeNaclFiles: (names: string[]) => Promise<Changes>
  getSourceMap: (filename: string) => Promise<parser.SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<parser.SourceRange[]>
  getErrors: () => Promise<Errors>
  getParsedNaclFile: (filename: string) => Promise<ParsedNaclFile | undefined>
  clone: () => NaclFilesSource<Changes>
  isEmpty: () => Promise<boolean>
  clear(args?: { nacl?: boolean; staticResources?: boolean; cache?: boolean }): Promise<void>
  getElementsSource: () => Promise<ElementsSource>
  load: (args: SourceLoadParams) => Promise<Changes>
  getSearchableNames(): Promise<string[]>
  getStaticFile: (args: {
    filePath: string
    encoding: BufferEncoding
    isTemplate?: boolean
    hash?: string
  }) => Promise<StaticFile | undefined>
  isPathIncluded: (filePath: string) => { included: boolean; isNacl?: boolean }
}

type NaclFilesState = {
  parsedNaclFiles: ParsedNaclFileCache
  elementsIndex: RemoteMap<string[]>
  mergedElements: RemoteElementSource
  mergeErrors: RemoteMap<MergeError[]>
  searchableNamesIndex: RemoteMap<boolean>
  staticFilesIndex: RemoteMap<string[]>
  metadata: RemoteMap<string>
}

const getRemoteMapNamespace = (namespace: string, name: string): string => `naclFileSource-${name}-${namespace}`

export const toPathHint = (filename: string): string[] => {
  const dirName = osPath.dirname(filename)
  const dirPathSplitted = dirName === '.' ? [] : dirName.split(osPath.sep)
  return [...dirPathSplitted, osPath.basename(filename, osPath.extname(filename))]
}

// not returning `Record<string, ElemID[]>` on purpose, so we'll run `ElemID.fromFullName(..)`
// only when the element ids of a specific filename are requested
const createFilenameToElementIDFullNamesMapping = (
  currentState: NaclFilesState,
  naclFilesByName: Record<string, SyncParsedNaclFile>,
): Promise<Record<string, { path: string }[]>> =>
  log.timeDebug(
    () =>
      awu(currentState.elementsIndex.entries())
        .flatMap(({ key, value }) => value.map(filename => ({ path: key, filename })))
        .filter(({ filename }) => naclFilesByName[filename] !== undefined)
        .groupBy(({ filename }) => filename),
    'create filename to element id full names mapping from elements index',
  )

export const getElementsStaticFiles = (elements: Element[]): string[] => {
  const staticFiles = new Set<string>()

  const collectStaticFiles: WalkOnFunc = ({ value }) => {
    if (isStaticFile(value) || isInvalidStaticFile(value)) {
      staticFiles.add(value.filepath)
    }
    return WALK_NEXT_STEP.RECURSE
  }

  elements.forEach(element =>
    walkOnElement({
      element,
      func: collectStaticFiles,
    }),
  )

  return Array.from(staticFiles)
}

const loadStaticFiles = (elements: Element[]): (() => string[]) => {
  let staticFiles: string[]

  const getStaticFiles = (): string[] => {
    if (staticFiles === undefined) {
      staticFiles = getElementsStaticFiles(elements)
    }
    return staticFiles
  }

  return getStaticFiles
}

export const toParsedNaclFile = (
  naclFile: NaclFile,
  { elements, errors, sourceMap }: parser.ParseResult,
): SyncParsedNaclFile => ({
  filename: naclFile.filename,
  elements: () => elements,
  data: {
    errors: () => errors,
    staticFiles: loadStaticFiles(elements),
  },
  buffer: naclFile.buffer,
  sourceMap: sourceMap !== undefined ? () => sourceMap : undefined,
})

type ParseNaclFileArgs = {
  naclFile: NaclFile
  functions: parser.Functions
  createSourceMap?: boolean
}
async function parseNaclFile(args: ParseNaclFileArgs & { createSourceMap?: false }): Promise<parser.ParseResult>
async function parseNaclFile(
  args: ParseNaclFileArgs & { createSourceMap: boolean },
): Promise<Required<parser.ParseResult>>
async function parseNaclFile({
  naclFile,
  functions,
  createSourceMap = false,
}: ParseNaclFileArgs): Promise<parser.ParseResult> {
  return parser.parse(Buffer.from(naclFile.buffer), naclFile.filename, functions, createSourceMap)
}

type ParseNaclFilesArgs = {
  naclFiles: NaclFile[]
  functions: parser.Functions
  createSourceMap?: boolean
}

const parseNaclFiles = async ({ naclFiles, functions }: ParseNaclFilesArgs): Promise<SyncParsedNaclFile[]> =>
  withLimitedConcurrency(
    naclFiles.map(naclFile => async () => toParsedNaclFile(naclFile, await parseNaclFile({ naclFile, functions }))),
    PARSE_CONCURRENCY,
  )

const isEmptyNaclFile = (naclFile: SyncParsedNaclFile): boolean =>
  _.isEmpty(naclFile.elements()) && _.isEmpty(naclFile.data.errors())

export const getFunctions = (staticFilesSource: StaticFilesSource): parser.Functions => ({
  ...getStaticFilesFunctions(staticFilesSource), // add future functions here
})

type buildNaclFilesStateResult = { state: NaclFilesState; changes: ChangeSet<Change> }

const createNaclFilesState = async (
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
  sourceName: string,
  persistent: boolean,
  parsedNaclFiles?: ParsedNaclFileCache,
): Promise<NaclFilesState> => ({
  elementsIndex: await remoteMapCreator.create<string[]>({
    namespace: getRemoteMapNamespace('elements_index', sourceName),
    serialize: async val => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
    persistent,
  }),
  mergeErrors: await remoteMapCreator.create<MergeError[]>({
    namespace: getRemoteMapNamespace('errors', sourceName),
    serialize: errors => serialize(errors, 'keepRef'),
    deserialize: async data => deserializeMergeErrors(data),
    persistent,
  }),
  mergedElements: new RemoteElementSource(
    await remoteMapCreator.create<Element>({
      namespace: getRemoteMapNamespace('merged', sourceName),
      serialize: async element => serialize([element], 'keepRef'),
      deserialize: async data => deserializeSingleElement(data, async sf => staticFilesSource.getStaticFile(sf)),
      persistent,
    }),
  ),
  parsedNaclFiles:
    parsedNaclFiles ??
    createParseResultCache(
      getRemoteMapNamespace('parsed_nacl_files', sourceName),
      remoteMapCreator,
      staticFilesSource,
      persistent,
    ),
  searchableNamesIndex: await remoteMapCreator.create<boolean>({
    namespace: getRemoteMapNamespace('searchableNamesIndex', sourceName),
    serialize: async val => (val === true ? '1' : '0'),
    deserialize: async data => data !== '0',
    persistent,
  }),
  staticFilesIndex: await remoteMapCreator.create<string[]>({
    namespace: getRemoteMapNamespace('static_files_index', sourceName),
    serialize: async val => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
    persistent,
  }),
  metadata: await remoteMapCreator.create<string>({
    namespace: getRemoteMapNamespace('metadata', sourceName),
    serialize: async val => val,
    deserialize: async data => data,
    persistent,
  }),
})

const buildNaclFilesState = async ({
  newNaclFiles,
  currentState,
}: {
  newNaclFiles: SyncParsedNaclFile[]
  currentState: NaclFilesState
}): Promise<buildNaclFilesStateResult> => {
  const preChangeHash = await currentState.metadata.get(HASH_KEY)
  const cacheValid = preChangeHash === (await currentState.parsedNaclFiles.getHash())
  log.debug('building elements indices for %d NaCl files', newNaclFiles.length)
  const newParsed = _.keyBy(newNaclFiles, parsed => parsed.filename)
  const elementsIndexAdditions: Record<string, Set<string>> = {}
  const staticFilesIndexAdditions: Record<string, Set<string>> = {}
  const elementsIndexDeletions: Record<string, Set<string>> = {}
  const staticFilesIndexDeletions: Record<string, Set<string>> = {}
  // We need to iterate over this twice - so no point in making this iterable :/
  const relevantElementIDs: ElemID[] = []
  const newElementsToMerge: Element[] = []

  const shouldCreateFilenameToElementIDsMapping = getSaltoFlagBool(WORKSPACE_FLAGS.createFilenamesToElementIdsMapping)
  log.debug('shouldCreateFilenameToElementIDsMapping is %s', shouldCreateFilenameToElementIDsMapping)

  const filenameToElementIDFullNames =
    !_.isEmpty(newParsed) && shouldCreateFilenameToElementIDsMapping
      ? await createFilenameToElementIDFullNamesMapping(currentState, newParsed)
      : {}

  const getElementIDsFromNaclFile = async (naclFile: ParsedNaclFile): Promise<ElemID[]> => {
    if (shouldCreateFilenameToElementIDsMapping) {
      const elementIDFullnamesInNaclFile = filenameToElementIDFullNames[naclFile.filename] ?? []
      return elementIDFullnamesInNaclFile.map(({ path }) => ElemID.fromFullName(path))
    }
    const elementsInNaclFile = (await naclFile.elements()) ?? []
    return elementsInNaclFile.map(element => element.elemID)
  }

  const updateIndex = async <T>(
    index: RemoteMap<T[]>,
    additions: Record<string, Set<T>>,
    deletions: Record<string, Set<T>>,
  ): Promise<void> => {
    const changedKeys = _.uniq(Object.keys(additions).concat(Object.keys(deletions)))
    const newEntries = await withLimitedConcurrency(
      changedKeys.map(key => async () => {
        const currentValues = (await index.get(key)) ?? []
        const keyDeletionsSet = deletions[key] ?? new Set()
        const keyAdditions = Array.from(additions[key]?.values() ?? [])
        const newValues = currentValues.filter(value => !keyDeletionsSet.has(value)).concat(keyAdditions)
        return { key, value: _.uniq(newValues) }
      }),
      UPDATE_INDEX_CONCURRENCY,
    )
    const [entriesToSet, entriesToDelete] = _.partition(newEntries, e => e.value.length > 0)
    await index.deleteAll(awu(entriesToDelete).map(e => e.key))
    await index.setAll(awu(entriesToSet))
  }

  const updateSearchableNamesIndex = async (changes: Change[]): Promise<void> => {
    const [additions, removals] = _.partition(
      changes
        .flatMap(change => {
          if (isModificationChange(change)) {
            if (isObjectTypeChange(change)) {
              const beforeFields = Object.values(change.data.before.fields)
              const afterFields = Object.values(change.data.after.fields)
              const additionFields = afterFields.filter(
                field => !beforeFields.find(f => f.elemID.isEqual(field.elemID)),
              )
              const removalFields = beforeFields.filter(field => !afterFields.find(f => f.elemID.isEqual(field.elemID)))
              return [
                ...additionFields.map(f => toChange({ after: f })),
                ...removalFields.map(f => toChange({ before: f })),
              ]
            }
          }
          return change
        })
        .filter(change => !isModificationChange(change)),
      isAdditionChange,
    )
    const additionsNames = _.uniq(additions.flatMap(getRelevantNamesFromChange))
    await currentState.searchableNamesIndex.setAll(additionsNames.map(name => ({ key: name, value: true })))
    const removalNames = _.uniq(removals.flatMap(getRelevantNamesFromChange))
    await currentState.searchableNamesIndex.deleteAll(removalNames)
  }
  const updateIndexOfFile = (
    indexAdditions: Record<string, Set<string>>,
    indexDeletions: Record<string, Set<string>>,
    filename: string,
    oldElemFullNames: string[] = [],
    currentElemFullNames: string[] = [],
  ): void => {
    const oldElemFullNamesSet = new Set(oldElemFullNames)
    const currentElemFullNamesSet = new Set(currentElemFullNames)
    collections.set.difference(currentElemFullNamesSet, oldElemFullNamesSet).forEach(fullName => {
      indexAdditions[fullName] = indexAdditions[fullName] ?? new Set<string>()
      indexAdditions[fullName].add(filename)
    })
    collections.set.difference(oldElemFullNamesSet, currentElemFullNamesSet).forEach(fullName => {
      indexDeletions[fullName] = indexDeletions[fullName] ?? new Set<string>()
      indexDeletions[fullName].add(filename)
    })
  }

  const getParsedNaclFileFromCache = (file: SyncParsedNaclFile): Promise<ParsedNaclFile> =>
    currentState.parsedNaclFiles.get(file.filename)

  const handleAdditionsOrModifications = (naclFiles: SyncParsedNaclFile[]): Promise<void> =>
    log.timeDebug(async () => {
      await awu(naclFiles).forEach(async naclFile => {
        const parsedFile = await getParsedNaclFileFromCache(naclFile)
        log.trace('Updating indexes of nacl file: %s', naclFile.filename)
        updateIndexOfFile(
          staticFilesIndexAdditions,
          staticFilesIndexDeletions,
          naclFile.filename,
          await parsedFile.data.staticFiles(),
          naclFile.data.staticFiles(),
        )

        const currentNaclFileElements = naclFile.elements() ?? []
        const oldNaclFileElementIDs = await getElementIDsFromNaclFile(parsedFile)
        updateIndexOfFile(
          elementsIndexAdditions,
          elementsIndexDeletions,
          naclFile.filename,
          oldNaclFileElementIDs.map(elemID => elemID.getFullName()),
          currentNaclFileElements.map(e => e.elemID.getFullName()),
        )
        relevantElementIDs.push(...currentNaclFileElements.map(e => e.elemID), ...oldNaclFileElementIDs)
        currentNaclFileElements.forEach(element => newElementsToMerge.push(element))
        // This is temp and should be removed when we change the init flow
        // This happens now cause we get here with ParsedNaclFiles that originate from the cache
        if (values.isDefined(naclFile.buffer)) {
          await currentState.parsedNaclFiles.put(naclFile.filename, naclFile)
        }
        log.trace('Finished updating indexes of %s', naclFile.filename)
      })
    }, 'handle additions/modifications of nacl files')

  const handleDeletions = (naclFiles: SyncParsedNaclFile[]): Promise<void> =>
    log.timeDebug(async () => {
      const toDelete: string[] = []
      await awu(naclFiles).forEach(async naclFile => {
        const oldNaclFile = await getParsedNaclFileFromCache(naclFile)

        log.trace('Updating indexes of deleted nacl file: %s', naclFile.filename)
        const oldNaclFileElementIDs = await getElementIDsFromNaclFile(oldNaclFile)
        oldNaclFileElementIDs.forEach(elemID => {
          const elementFullName = elemID.getFullName()
          elementsIndexDeletions[elementFullName] = elementsIndexDeletions[elementFullName] ?? new Set<string>()
          elementsIndexDeletions[elementFullName].add(oldNaclFile.filename)
        })
        relevantElementIDs.push(...oldNaclFileElementIDs)
        toDelete.push(naclFile.filename)
        log.trace('Finished updating indexes of %s', naclFile.filename)
      })
      await currentState.parsedNaclFiles.deleteAll(toDelete)
    }, 'handle deletions of nacl files')

  const [emptyNaclFiles, nonEmptyNaclFiles] = _.partition(Object.values(newParsed), isEmptyNaclFile)
  await handleDeletions(emptyNaclFiles)
  await handleAdditionsOrModifications(nonEmptyNaclFiles)

  const unmodifiedFragments = awu(_.uniqBy(relevantElementIDs, e => e.getFullName()))
    .flatMap(async elemID => {
      const unmodifiedFilesWithElem = ((await currentState.elementsIndex.get(elemID.getFullName())) ?? []).filter(
        (filename: string) => newParsed[filename] === undefined,
      )

      return awu(unmodifiedFilesWithElem).map(async filename =>
        ((await (await currentState.parsedNaclFiles.get(filename)).elements()) ?? []).find(e =>
          e.elemID.isEqual(elemID),
        ),
      )
    })
    .filter(values.isDefined)
  const changes = await buildNewMergedElementsAndErrors({
    afterElements: awu(newElementsToMerge).concat(unmodifiedFragments),
    relevantElementIDs: awu(relevantElementIDs),
    currentElements: currentState.mergedElements,
    currentErrors: currentState.mergeErrors,
    mergeFunc: elements => mergeElements(elements),
  })
  const postChangeHash = await currentState.parsedNaclFiles.getHash()
  await Promise.all([
    updateIndex(currentState.elementsIndex, elementsIndexAdditions, elementsIndexDeletions),
    updateIndex(currentState.staticFilesIndex, staticFilesIndexAdditions, staticFilesIndexDeletions),
    updateSearchableNamesIndex(changes),
  ])
  if (postChangeHash !== preChangeHash) {
    if (postChangeHash === undefined) {
      await currentState.metadata.delete(HASH_KEY)
    } else {
      await currentState.metadata.set(HASH_KEY, postChangeHash)
    }
  }
  return {
    state: currentState,
    changes: { changes, cacheValid, preChangeHash, postChangeHash },
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

const filterStaticFilesByIndex = async (
  danglingStaticFiles: StaticFile[],
  staticFileIndex: Pick<RemoteMap<string[]>, 'get'>,
): Promise<StaticFile[]> => {
  const elementsByFilePaths = _.groupBy(danglingStaticFiles, file => file.filepath)
  const files = await Promise.all(
    _.flatMap(elementsByFilePaths, async (staticFiles, filePath) => {
      const indexedStaticFileAmount = (await staticFileIndex.get(filePath))?.length
      if (indexedStaticFileAmount && staticFiles.length < indexedStaticFileAmount) {
        // There are additional static files in the index that are not in the changes
        log.debug(
          `For static file ${filePath}: Trying to remove ${staticFiles.length} while there are ${indexedStaticFileAmount} files in the index.`,
        )
        return []
      }
      // All static files were removed
      return staticFiles
    }),
  )
  return files.flat()
}

/* 
  Returns a list of all static files that existed in the changes 'before' and doesn't exist in the 'after'
  If staticFileIndex is defined, it also checks whether there are any other elements that still point to the specific file.
  NOTE: Because of the current structure of the static file index, 
  we can't recognize the case where a single file has pointers to the same static file multiple times.
  This can be either with a single element that has multiple pointers to the same file, or multiple elements that point to the same static file.
*/
export const getDanglingStaticFiles = async (
  fileChanges: DetailedChange[],
  staticFileIndex?: Pick<RemoteMap<string[]>, 'get'>,
): Promise<StaticFile[]> => {
  const beforeFilePaths = fileChanges
    .filter(isRemovalOrModificationChange)
    .map(({ id, data }) => ({ id, data: data.before }))
    .flatMap(getNestedStaticFiles)
  if (beforeFilePaths.length === 0) {
    log.debug('no static files were found in the changes before')
    return []
  }
  const afterFilePaths = new Set<string>(
    fileChanges
      .filter(isAdditionOrModificationChange)
      .map(change => change.data.after)
      .flatMap(getNestedStaticFiles)
      .map(file => file.filepath),
  )
  const potentiallyDanglingStaticFiles = beforeFilePaths.filter(staticFile => !afterFilePaths.has(staticFile.filepath))
  const danglingStaticFiles =
    staticFileIndex === undefined
      ? potentiallyDanglingStaticFiles
      : await filterStaticFilesByIndex(potentiallyDanglingStaticFiles, staticFileIndex)
  log.debug(
    'found %d dangling static files, out of %d static files in the changes before. %d static files with multiple pointers were filtered out.',
    danglingStaticFiles.length,
    beforeFilePaths.length,
    potentiallyDanglingStaticFiles.length - danglingStaticFiles.length,
  )
  return danglingStaticFiles
}

const buildNaclFilesSource = (
  sourceName: string,
  naclFilesStore: DirectoryStore<string>,
  staticFilesSource: StaticFilesSource,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
  initState?: Promise<NaclFilesState>,
): NaclFilesSource => {
  const functions: parser.Functions = getFunctions(staticFilesSource)

  let state = initState
  let initChanges: ChangeSet<Change> | undefined

  const getState = (): Promise<NaclFilesState> => {
    if (_.isUndefined(state)) {
      throw new Error('can not get state before load was invoked')
    }
    return state
  }

  const buildInitState = async (ignoreFileChanges = false): Promise<buildNaclFilesStateResult> => {
    const currentState = await createNaclFilesState(remoteMapCreator, staticFilesSource, sourceName, persistent)
    if (!ignoreFileChanges) {
      const preChangeHash = await currentState.parsedNaclFiles.getHash()
      const cacheFilenames = await currentState.parsedNaclFiles.list()
      const modifiedStaticFiles = (await staticFilesSource.load?.()) ?? []
      const naclFilenames = new Set(await naclFilesStore.list())
      const fileNames = new Set()
      const modifiedNaclFiles: NaclFile[] = []
      const naclReferencingModifiedStaticFiles = new Set(
        (await currentState.staticFilesIndex.getMany(modifiedStaticFiles)).filter(values.isDefined).flat(),
      )
      await withLimitedConcurrency(
        cacheFilenames.map(filename => async () => {
          const naclFile = (naclFilenames.has(filename) && (await naclFilesStore.get(filename))) || {
            filename,
            buffer: '',
          }
          const validCache = await currentState.parsedNaclFiles.hasValid(naclFile)
          if (!validCache || naclReferencingModifiedStaticFiles.has(filename)) {
            modifiedNaclFiles.push(naclFile)
          }
          fileNames.add(filename)
          return undefined
        }),
        CACHE_READ_CONCURRENCY,
      )
      await withLimitedConcurrency(
        wu(naclFilenames).map(filename => async () => {
          if (!fileNames.has(filename)) {
            modifiedNaclFiles.push((await naclFilesStore.get(filename)) ?? { filename, buffer: '' })
          }
          fileNames.add(filename)
        }),
        CACHE_READ_CONCURRENCY,
      )
      const parsedModifiedFiles = await parseNaclFiles({
        naclFiles: modifiedNaclFiles,
        functions,
      })
      const result = await buildNaclFilesState({
        newNaclFiles: parsedModifiedFiles,
        currentState,
      })
      if (result.changes.changes.length > 0) {
        log.info('loading nacl file source found %d changes', result.changes.changes.length)
      }
      result.changes.preChangeHash = preChangeHash
      return result
    }
    return {
      changes: {
        changes: [],
        cacheValid: true,
        preChangeHash: undefined,
        postChangeHash: undefined,
      },
      state: currentState,
    }
  }

  const buildNaclFilesStateInner = async (
    parsedNaclFiles: SyncParsedNaclFile[] = [],
    ignoreFileChanges = false,
  ): Promise<buildNaclFilesStateResult> => {
    if (_.isUndefined(state)) {
      return buildInitState(ignoreFileChanges)
    }
    const current = await state
    return buildNaclFilesState({
      newNaclFiles: parsedNaclFiles,
      currentState: current,
    })
  }

  const getNaclFile = (filename: string): Promise<NaclFile | undefined> => naclFilesStore.get(filename)

  const getParsedNaclFile = async (filename: string): Promise<ParsedNaclFile | undefined> => {
    const addPathParsedNaclFileElements = (parsed: SyncParsedNaclFile | ParsedNaclFile): ParsedNaclFile => ({
      ...parsed,
      elements: async () => {
        const parsedElement = await parsed.elements()
        return (
          parsedElement &&
          parsedElement.map(elem => {
            elem.path = toPathHint(filename)
            return elem
          })
        )
      },
      data: {
        errors: () => Promise.resolve(parsed.data.errors()),
        staticFiles: () => Promise.resolve(parsed.data.staticFiles()),
      },
      sourceMap: () => Promise.resolve(parsed.sourceMap?.()),
    })

    // We don't want to parse all nacl files here when we want only parsedResult of one file.
    if (state !== undefined) {
      return addPathParsedNaclFileElements(await (await getState()).parsedNaclFiles.get(filename))
    }
    const naclFile = await getNaclFile(filename)
    if (naclFile === undefined) return undefined
    return addPathParsedNaclFileElements(toParsedNaclFile(naclFile, await parseNaclFile({ naclFile, functions })))
  }

  const getElementNaclFiles = async (elemID: ElemID): Promise<string[]> => {
    const topLevelID = elemID.createTopLevelParentID()
    const topLevelFiles = (await (await getState()).elementsIndex.get(topLevelID.parent.getFullName())) ?? []
    if (elemID.isTopLevel()) {
      return topLevelFiles
    }
    return (
      await Promise.all(
        topLevelFiles.map(async filename => {
          const fragments = await (await (await getState()).parsedNaclFiles.get(filename)).elements()
          return wu(fragments ?? []).some(fragment => resolvePath(fragment, elemID) !== undefined)
            ? filename
            : undefined
        }),
      )
    ).filter(values.isDefined)
  }

  const getSourceMap = async (filename: string, useCache = true): Promise<parser.SourceMap> => {
    if (useCache) {
      const parsedNaclFile = await (await getState()).parsedNaclFiles.get(filename)
      const naclFileSourceMap = await parsedNaclFile.sourceMap()
      if (values.isDefined(naclFileSourceMap)) {
        return naclFileSourceMap
      }
    }
    const naclFile = await naclFilesStore.get(filename)
    if (_.isUndefined(naclFile)) {
      log.error('failed to find %s in NaCl file store', filename)
      return new parser.SourceMap()
    }
    const parsedResult = await parseNaclFile({ naclFile, functions, createSourceMap: true })
    if (useCache) {
      const newParsedNaclFile = toParsedNaclFile(naclFile, parsedResult)
      await (await getState()).parsedNaclFiles.put(filename, newParsedNaclFile)
    }
    return parsedResult.sourceMap
  }

  const createNaclFileFromChange = (
    filename: string,
    change: AdditionDiff<Element>,
    fileData: string,
  ): SyncParsedNaclFile => {
    const elements = [change.data.after]
    return {
      filename,
      elements: () => elements,
      data: {
        errors: () => [],
        staticFiles: loadStaticFiles(elements),
      },
      buffer: fileData,
    }
  }

  const setNaclFiles = async (naclFiles: NaclFile[]): Promise<void> => {
    const [emptyNaclFiles, nonEmptyNaclFiles] = _.partition(naclFiles, naclFile => _.isEmpty(naclFile.buffer.trim()))
    await awu(nonEmptyNaclFiles).forEach(naclFile => naclFilesStore.set(naclFile))
    await awu(emptyNaclFiles).forEach(naclFile => naclFilesStore.delete(naclFile.filename))
  }

  const getChangeLocationsForFiles = async (
    changes: DetailedChangeWithBaseChange[],
    naclFiles: string[],
  ): Promise<DetailedChangeWithSource[]> => {
    const { parsedNaclFiles } = await getState()
    const changedFileSourceMaps = (
      await withLimitedConcurrency(
        naclFiles.map(naclFile => async () => {
          const parsedNaclFile = await parsedNaclFiles.get(naclFile)
          return values.isDefined(parsedNaclFile) ? getSourceMap(parsedNaclFile.filename, false) : undefined
        }),
        SOURCE_MAP_READ_CONCURRENCY,
      )
    ).filter(values.isDefined)

    const mergedSourceMap = changedFileSourceMaps.reduce((acc, sourceMap) => {
      acc.merge(sourceMap)
      return acc
    }, new parser.SourceMap())

    const changesWithLocation = getChangesToUpdate(changes, mergedSourceMap).flatMap(change =>
      getChangeLocations(change, mergedSourceMap),
    )

    return changesWithLocation
  }

  const getChangesWithLocationsSplitSourceMap = async (
    changes: DetailedChangeWithBaseChange[],
  ): Promise<DetailedChangeWithSource[]> => {
    // Create separate source maps for groups of files and then find the location for each group of files separately
    const currentState = await getState()

    const changesByTopLevel = _.groupBy(changes, change => change.id.createTopLevelParentID().parent.getFullName())
    // Note - by using the top level ID, we might read files that are not strictly needed
    // e.g - if the element is split between two files, but our change is in one of them, we will parse the other file as well.
    const potentialFilesByElementID = _.zipObject(
      Object.keys(changesByTopLevel),
      await currentState.elementsIndex.getMany(Object.keys(changesByTopLevel)),
    )
    // Note - this is not ideal grouping, in theory this grouping could cause us to read the same file(s) multiple times.
    // This grouping should be good enough under the assumption that in most cases elements are either:
    // 1. in a single file that contains only one element (most elements)
    // 2. split to multiple files that all contain only one element (less common, mostly used for very large elements)
    // 3. in a single file that contains other elements as well (less common, mostly used for large numbers of very small elements)

    // Examples of a case where we would read the same file twice:
    // - Element A exists in files 1,2,3
    // - Element B exists in file 1
    // With the current logic, this will cause us to read file 1 twice, but this should not affect the correctness of the result.
    // Note that we do not cache the source maps on purpose - they consume too much memory.
    const changesByFiles = _.groupBy(
      Object.entries(changesByTopLevel).map(([id, elementChanges]) => ({
        elementChanges,
        potentialFiles: potentialFilesByElementID[id],
      })),
      ({ potentialFiles }) => potentialFiles?.join(','),
    )
    log.debug(
      'Nacl source %s getting source maps for %d nacl file groups',
      sourceName,
      Object.keys(changesByFiles).length,
    )
    const changesWithLocationsByFiles = await withLimitedConcurrency(
      Object.values(changesByFiles).map(
        changeGroups => () =>
          getChangeLocationsForFiles(
            changeGroups.flatMap(group => group.elementChanges),
            // this is grouped by potential files, so all groups have the same list here
            changeGroups[0].potentialFiles ?? [],
          ),
      ),
      SOURCE_MAP_READ_CONCURRENCY,
    )
    return changesWithLocationsByFiles.flat()
  }

  const getChangesWithLocationsUnifiedSourceMap = async (
    changes: DetailedChangeWithBaseChange[],
  ): Promise<DetailedChangeWithSource[]> => {
    // Create a unified source map for all files and find the locations for all changes together
    const naclFiles = _.uniq(
      await awu(changes)
        .map(change => change.id)
        .flatMap(elemID => getElementNaclFiles(elemID.createTopLevelParentID().parent))
        .toArray(),
    )
    log.debug('Nacl source %s getting source maps for %d nacl files', sourceName, naclFiles.length)
    return getChangeLocationsForFiles(changes, naclFiles)
  }

  const groupChangesByFilename = (
    changes: DetailedChangeWithBaseChange[],
  ): Promise<Record<string, DetailedChangeWithSource[]>> =>
    log.timeDebug(
      async () => {
        const changesWithLocation = getSaltoFlagBool(WORKSPACE_FLAGS.useSplitSourceMapInUpdate)
          ? await getChangesWithLocationsSplitSourceMap(changes)
          : await getChangesWithLocationsUnifiedSourceMap(changes)

        return _.groupBy(
          changesWithLocation,
          // Group changes file, we use lower case in order to support case insensitive file systems
          change => change.location.filename.toLowerCase(),
        )
      },
      'groupChangesByFilename for %d changes',
      changes.length,
    )

  const updateNaclFiles = async (changes: DetailedChangeWithBaseChange[]): Promise<ChangeSet<Change>> => {
    const preChangeHash = await (await state)?.parsedNaclFiles.getHash()
    const getNaclFileData = async (filename: string): Promise<string> => {
      const naclFile = await naclFilesStore.get(filename)
      return naclFile ? naclFile.buffer : ''
    }

    const removeDanglingStaticFiles = async (allChanges: DetailedChange[]): Promise<void> => {
      const { staticFilesIndex } = await getState()
      const danglingStaticFiles = await getDanglingStaticFiles(allChanges, staticFilesIndex)
      await Promise.all(danglingStaticFiles.map(file => staticFilesSource.delete(file)))
    }
    const changesByFileName = await groupChangesByFilename(changes)
    log.debug(
      'Nacl source %s going to update %d nacl files with %d changes',
      sourceName,
      Object.keys(changesByFileName).length,
      changes.length,
    )

    const { parsedNaclFiles } = await getState()
    const allFileNames = _.keyBy(await parsedNaclFiles.list(), name => name.toLowerCase())
    let appliedChanges: DetailedChange[] = []
    const updatedNaclFiles = (
      await withLimitedConcurrency(
        Object.entries(changesByFileName).map(
          ([lowerCaseFilename, fileChanges]) =>
            async (): Promise<(SyncParsedNaclFile & NaclFile) | undefined> => {
              // Changes might have a different cased filename, we take the version that already exists
              // or the first variation if this is a new file
              const filename =
                allFileNames[lowerCaseFilename] ?? fileChanges.map(change => change.location.filename).sort()[0]
              try {
                const naclFileData = await getNaclFileData(filename)
                log.trace(
                  'Nacl source %s starting to update file %s with %d changes',
                  sourceName,
                  filename,
                  fileChanges.length,
                )
                const buffer = await updateNaclFileData(naclFileData, fileChanges, functions)
                const shouldNotParse =
                  _.isEmpty(naclFileData) &&
                  fileChanges.length === 1 &&
                  fileChanges[0].action === 'add' &&
                  isElement(fileChanges[0].data.after)
                const parsed = shouldNotParse
                  ? createNaclFileFromChange(filename, fileChanges[0] as AdditionDiff<Element>, buffer)
                  : toParsedNaclFile(
                      { filename, buffer },
                      await parser.parse(Buffer.from(buffer), filename, functions, false),
                    )
                if (!_.isEmpty(parsed.data.errors())) {
                  logNaclFileUpdateErrorContext(filename, fileChanges, naclFileData, buffer)
                }
                log.trace(
                  'Nacl source %s finished updating file %s with %d changes',
                  sourceName,
                  filename,
                  fileChanges.length,
                )
                const { data, elements } = parsed
                appliedChanges = appliedChanges.concat(fileChanges)
                return { filename, elements, data, buffer }
              } catch (e) {
                log.error('failed to update NaCl file %s due to %o with %o changes', filename, e, fileChanges)
                return undefined
              }
            },
        ),
        DUMP_CONCURRENCY,
      )
    ).filter(values.isDefined)
    await removeDanglingStaticFiles(appliedChanges)

    if (updatedNaclFiles.length > 0) {
      log.debug('going to update %d NaCl files', updatedNaclFiles.length)
      // The map is to avoid saving unnecessary fields in the nacl files
      await setNaclFiles(updatedNaclFiles.map(file => _.pick(file, ['buffer', 'filename'])))
      const res = await buildNaclFilesStateInner(updatedNaclFiles)
      state = Promise.resolve(res.state)
      res.changes.preChangeHash = preChangeHash
      res.changes.postChangeHash = await (await state).parsedNaclFiles.getHash()
      return res.changes
    }
    return {
      changes: [],
      cacheValid: true,
      preChangeHash,
      postChangeHash: await (await state)?.parsedNaclFiles.getHash(),
    }
  }

  return {
    list: async (): Promise<AsyncIterable<ElemID>> =>
      awu((await getState()).elementsIndex.keys()).map(name => ElemID.fromFullName(name)),
    has: async (id: ElemID): Promise<boolean> => (await getState()).mergedElements.has(id),
    delete: async (id: ElemID): Promise<void> => (await getState()).mergedElements.delete(id),
    deleteAll: async (ids: ThenableIterable<ElemID>): Promise<void> => (await getState()).mergedElements.deleteAll(ids),
    set: async (element: Element): Promise<void> => (await getState()).mergedElements.set(element),
    setAll: async (elements: ThenableIterable<Element>): Promise<void> =>
      (await getState()).mergedElements.setAll(elements),
    get: async (id: ElemID): Promise<Element | Value> => {
      const currentState = await getState()
      const { parent, path } = id.createTopLevelParentID()
      const baseElement = await currentState.mergedElements.get(parent)
      return baseElement && !_.isEmpty(path) ? resolvePath(baseElement, id) : baseElement
    },
    getAll: async (): Promise<AsyncIterable<Element>> => (await getState()).mergedElements.getAll(),

    flush: async (): Promise<void> => {
      await naclFilesStore.flush()
      await staticFilesSource.flush()
      const currentState = await getState()
      await currentState.elementsIndex.flush()
      await currentState.mergeErrors.flush()
      await currentState.mergedElements.flush()
      await currentState.parsedNaclFiles.flush()
      await currentState.searchableNamesIndex.flush()
      await currentState.staticFilesIndex.flush()
      await currentState.metadata.flush()

      // clear deprecated referenced index
      const referencedIndex = await remoteMapCreator.create<string[]>({
        namespace: getRemoteMapNamespace('referenced_index', sourceName),
        serialize: async val => safeJsonStringify(val),
        deserialize: data => JSON.parse(data),
        persistent,
      })
      if (!(await referencedIndex.isEmpty())) {
        log.debug('going to clear entries of deprecated index referenced_index')
        await referencedIndex.clear()
        await referencedIndex.flush()
      }
    },

    getErrors: async (): Promise<Errors> => {
      const currentState = await getState()
      const [parseErrors, mergeErrors] = await Promise.all([
        currentState.parsedNaclFiles.getAllErrors(),
        awu(currentState.mergeErrors.values()).flat().toArray(),
      ])
      return new Errors({
        parse: parseErrors,
        merge: mergeErrors,
        validation: [],
      })
    },

    listNaclFiles: async (): Promise<string[]> => (await getState()).parsedNaclFiles.list(),

    getTotalSize: async (): Promise<number> =>
      _.sum(await Promise.all([naclFilesStore.getTotalSize(), staticFilesSource.getTotalSize()])),

    getNaclFile,

    getParsedNaclFile,

    getSourceRanges: async elemID => {
      const naclFiles = await getElementNaclFiles(elemID)
      const sourceRanges = await withLimitedConcurrency(
        naclFiles.map(naclFile => async () => (await getSourceMap(naclFile)).get(elemID.getFullName()) || []),
        CACHE_READ_CONCURRENCY,
      )
      return _.flatten(sourceRanges)
    },

    removeNaclFiles: async (names: string[]) => {
      const preChangeHash = await (await getState()).parsedNaclFiles.getHash()
      await awu(names).forEach(name => naclFilesStore.delete(name))
      const res = await buildNaclFilesStateInner(
        await parseNaclFiles({ naclFiles: names.map(filename => ({ filename, buffer: '' })), functions }),
      )
      state = Promise.resolve(res.state)
      res.changes.preChangeHash = preChangeHash
      return res.changes
    },

    clear: async (args = { nacl: true, staticResources: true, cache: true }) => {
      if (args.staticResources && !(args.cache && args.nacl)) {
        throw new Error('Cannot clear static resources without clearing the cache and nacls')
      }

      // The order is important
      if (args.staticResources) {
        await staticFilesSource.clear()
      }
      if (args.nacl) {
        await naclFilesStore.clear()
      }
      if (args.cache) {
        const currentState = await getState()
        await currentState.elementsIndex.clear()
        await currentState.mergeErrors.clear()
        await currentState.mergedElements.clear()
        await currentState.parsedNaclFiles.clear()
        await currentState.searchableNamesIndex.clear()
        await currentState.metadata.clear()
        await currentState.staticFilesIndex.clear()
      }
      initChanges = undefined
      state = undefined
    },

    rename: async (name: string) => {
      await naclFilesStore.rename(name)
      await staticFilesSource.rename(name)
      const currentState = await getState()
      await currentState.parsedNaclFiles.rename(getRemoteMapNamespace('parsed_nacl_files', name))
      const newCurrentState = await createNaclFilesState(
        remoteMapCreator,
        staticFilesSource,
        name,
        persistent,
        currentState.parsedNaclFiles,
      )
      await newCurrentState.mergedElements.setAll(await currentState.mergedElements.getAll())
      await currentState.mergedElements.clear()
      await newCurrentState.elementsIndex.setAll(currentState.elementsIndex.entries())
      await currentState.elementsIndex.clear()
      await newCurrentState.mergeErrors.setAll(currentState.mergeErrors.entries())
      await currentState.mergeErrors.clear()
      await newCurrentState.metadata.setAll(currentState.metadata.entries())
      await currentState.metadata.clear()
      await newCurrentState.searchableNamesIndex.setAll(currentState.searchableNamesIndex.entries())
      await currentState.searchableNamesIndex.clear()
      state = Promise.resolve(newCurrentState)
    },

    clone: () =>
      buildNaclFilesSource(
        sourceName,
        naclFilesStore.clone(),
        staticFilesSource.clone(),
        remoteMapCreator,
        persistent,
        state,
      ),
    updateNaclFiles,
    setNaclFiles: async naclFiles => {
      await setNaclFiles(naclFiles)
      const res = await buildNaclFilesStateInner(await parseNaclFiles({ naclFiles, functions }))
      state = Promise.resolve(res.state)
      return res.changes
    },
    getSourceMap,
    getElementNaclFiles,
    getElementFileNames: async () => {
      const { elementsIndex } = await getState()
      const elementsIndexEntries = await awu(elementsIndex.entries()).groupBy(entry => entry.key)
      return new Map(
        Object.entries(_.mapValues(elementsIndexEntries, entries => entries.flatMap(entry => entry.value))),
      )
    },
    isEmpty: () => naclFilesStore.isEmpty(),
    getElementsSource: async () => (await getState()).mergedElements,
    load: async ({ ignoreFileChanges = false }: SourceLoadParams) => {
      if (initChanges === undefined) {
        const res = await buildNaclFilesStateInner([], ignoreFileChanges)
        state = Promise.resolve(res.state)
        initChanges = res.changes
      }
      return initChanges
    },
    getSearchableNames: async (): Promise<string[]> =>
      awu((await getState())?.searchableNamesIndex?.keys() ?? []).toArray(),
    getStaticFile: async args => {
      const staticFile = await staticFilesSource.getStaticFile({
        filepath: args.filePath,
        encoding: args.encoding,
        isTemplate: args.isTemplate,
        hash: args.hash,
      })
      if (isStaticFile(staticFile)) {
        return staticFile
      }
      return undefined
    },
    isPathIncluded: filePath => {
      if (naclFilesStore.isPathIncluded(filePath)) {
        return { included: true, isNacl: true }
      }
      if (staticFilesSource.isPathIncluded(filePath)) {
        return { included: true, isNacl: false }
      }
      return { included: false }
    },
  }
}

export const naclFilesSource = async (
  sourceName: string,
  naclFilesStore: DirectoryStore<string>,
  staticFilesSource: StaticFilesSource,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
): Promise<NaclFilesSource> =>
  buildNaclFilesSource(sourceName, naclFilesStore, staticFilesSource, remoteMapCreator, persistent)
