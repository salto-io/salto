/*
*                      Copyright 2023 Salto Labs Ltd.
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
import wu from 'wu'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Element, ElemID, Value, DetailedChange, isElement, getChangeData, isObjectType,
  isInstanceElement, isIndexPathPart, isReferenceExpression, isContainerType, isVariable, Change,
  placeholderReadonlyElementsSource, isModificationChange,
  isObjectTypeChange, toChange, isAdditionChange, StaticFile, isStaticFile } from '@salto-io/adapter-api'
import {
  resolvePath,
  TransformFuncArgs,
  transformElement,
  safeJsonStringify,
  getRelevantNamesFromChange,
} from '@salto-io/adapter-utils'
import { promises, values, collections } from '@salto-io/lowerdash'
import { AdditionDiff } from '@salto-io/dag'
import osPath from 'path'
import { MergeError, mergeElements } from '../../merger'
import { getChangeLocations, updateNaclFileData, getChangesToUpdate, DetailedChangeWithSource, getNestedStaticFiles } from './nacl_file_update'
import { parse, SourceRange, ParseResult, SourceMap } from '../../parser'
import { ElementsSource, RemoteElementSource } from '../elements_source'
import { DirectoryStore } from '../dir_store'
import { Errors } from '../errors'
import { StaticFilesSource } from '../static_files'
import { getStaticFilesFunctions } from '../static_files/functions'
import { buildNewMergedElementsAndErrors, ChangeSet } from './elements_cache'
import { serialize, deserializeMergeErrors, deserializeSingleElement } from '../../serializer/elements'
import { Functions } from '../../parser/functions'
import { RemoteMap, RemoteMapCreator } from '../remote_map'
import { ParsedNaclFile } from './parsed_nacl_file'
import { ParsedNaclFileCache, createParseResultCache } from './parsed_nacl_files_cache'
import { isInvalidStaticFile } from '../static_files/common'

const { awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>
type AwuIterable<T> = collections.asynciterable.AwuIterable<T>
const { withLimitedConcurrency } = promises.array

const log = logger(module)

export type RoutingMode = 'isolated' | 'default' | 'align' | 'override'

export const FILE_EXTENSION = '.nacl'
export const HASH_KEY = 'hash'

const PARSE_CONCURRENCY = 100
const DUMP_CONCURRENCY = 100
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

export type NaclFilesSource<Changes=ChangeSet<Change>> = Omit<ElementsSource, 'clear'> & {
  updateNaclFiles: (changes: DetailedChange[], mode?: RoutingMode) => Promise<Changes>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
  getElementReferencedFiles: (id: ElemID) => Promise<string[]>
  getElementFileNames: () => Promise<Map<string, string[]>>
  // TODO: this should be for single?
  setNaclFiles: (naclFiles: NaclFile[]) => Promise<Changes>
  removeNaclFiles: (names: string[]) => Promise<Changes>
  getSourceMap: (filename: string) => Promise<SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<SourceRange[]>
  getErrors: () => Promise<Errors>
  getParsedNaclFile: (filename: string) => Promise<ParsedNaclFile | undefined>
  clone: () => NaclFilesSource<Changes>
  isEmpty: () => Promise<boolean>
  clear(args?: {
    nacl?: boolean
    staticResources?: boolean
    cache?: boolean
  }): Promise<void>
  getElementsSource: () => Promise<ElementsSource>
  load: (args: SourceLoadParams) => Promise<Changes>
  getSearchableNames(): Promise<string[]>
  getStaticFile: (
    filePath: string,
    encoding: BufferEncoding,
  ) => Promise<StaticFile | undefined>
  isPathIncluded: (filePath: string) => {included: boolean; isNacl?: boolean}
}

type NaclFilesState = {
  parsedNaclFiles: ParsedNaclFileCache
  elementsIndex: RemoteMap<string[]>
  mergedElements: RemoteElementSource
  mergeErrors: RemoteMap<MergeError[]>
  referencedIndex: RemoteMap<string[]>
  searchableNamesIndex: RemoteMap<boolean>
  staticFilesIndex: RemoteMap<string[]>
  metadata: RemoteMap<string>
}

const getRemoteMapNamespace = (namespace: string, name: string): string =>
  `naclFileSource-${name}-${namespace}`


export const toPathHint = (filename: string): string[] => {
  const dirName = osPath.dirname(filename)
  const dirPathSplitted = (dirName === '.') ? [] : dirName.split(osPath.sep)
  return [...dirPathSplitted, osPath.basename(filename, osPath.extname(filename))]
}

export const getElementReferenced = async (element: Element): Promise<{
  referenced: Set<string>
  staticFiles: Set<string>
}> => {
  const referenced = new Set<string>()
  const staticFiles = new Set<string>()
  const transformFunc = ({ value, field, path }: TransformFuncArgs): Value => {
    if (field && path && !isIndexPathPart(path.name)) {
      referenced.add(
        ElemID.getTypeOrContainerTypeID(field.refType.elemID).getFullName()
      )
    }
    if (isReferenceExpression(value)) {
      const { parent, path: valueIDPath } = value.elemID.createTopLevelParentID()
      const nestedIds = valueIDPath.map((_p, index) => parent.createNestedID(
        ...(value.elemID.idType !== parent.idType ? [value.elemID.idType] : []),
        ...valueIDPath.slice(0, index + 1)
      ))
      referenced.add(parent.getFullName())
      nestedIds.forEach(id => referenced.add(id.getFullName()))
    }
    if (isStaticFile(value) || isInvalidStaticFile(value)) {
      staticFiles.add(value.filepath)
    }
    return value
  }

  if (isObjectType(element)) {
    Object.values(element.fields)
      .map(field => ElemID.getTypeOrContainerTypeID(field.refType.elemID))
      .forEach(id => referenced.add(id.getFullName()))
  }
  if (isInstanceElement(element)) {
    referenced.add(element.refType.elemID.getFullName())
  }
  Object.values(element.annotationRefTypes)
    .map(anno => ElemID.getTypeOrContainerTypeID(anno.elemID))
    .forEach(id => referenced.add(id.getFullName()))
  if (!isContainerType(element) && !isVariable(element)) {
    await transformElement({
      element,
      transformFunc,
      strict: false,
      elementsSource: placeholderReadonlyElementsSource,
    })
  }
  return {
    referenced,
    staticFiles,
  }
}

const getElementsReferencedAndStaticFiles = (elements: ThenableIterable<Element>): Promise<{
  referenced: Set<string>
  staticFiles: Set<string>
}> => awu(elements)
  .reduce(async (acc, element) => {
    const elementRefs = await getElementReferenced(element)
    wu(elementRefs.referenced.keys()).forEach(key => acc.referenced.add(key))
    wu(elementRefs.staticFiles.keys()).forEach(key => acc.staticFiles.add(key))
    return acc
  }, { referenced: new Set<string>(), staticFiles: new Set<string>() })

export const toParsedNaclFile = async (
  naclFile: NaclFile,
  parseResult: ParseResult
): Promise<ParsedNaclFile> => {
  let referenced: string[]
  let staticFiles: string[]
  const loadRefs = async (): Promise<void> => {
    if (referenced === undefined || staticFiles === undefined) {
      const referencedAndStaticFiles = await getElementsReferencedAndStaticFiles(
        parseResult.elements
      )
      referenced = Array.from(referencedAndStaticFiles.referenced)
      staticFiles = Array.from(referencedAndStaticFiles.staticFiles)
    }
  }
  return {
    filename: naclFile.filename,
    elements: () => awu(parseResult.elements).toArray(),
    data: {
      errors: () => Promise.resolve(parseResult.errors),
      referenced: async () => {
        await loadRefs()
        return referenced
      },
      staticFiles: async () => {
        await loadRefs()
        return staticFiles
      },
    },
    buffer: naclFile.buffer,
    sourceMap: () => Promise.resolve(parseResult.sourceMap),
  }
}

const parseNaclFile = async (
  naclFile: NaclFile, functions: Functions,
): Promise<Required<ParseResult>> =>
  (parse(Buffer.from(naclFile.buffer), naclFile.filename, functions))

const parseNaclFiles = async (
  naclFiles: NaclFile[], functions: Functions
): Promise<ParsedNaclFile[]> => (
  withLimitedConcurrency(
    naclFiles.map(
      naclFile => async () => toParsedNaclFile(naclFile, await parseNaclFile(naclFile, functions))
    ),
    PARSE_CONCURRENCY,
  )
)

const isEmptyNaclFile = async (naclFile: ParsedNaclFile): Promise<boolean> => (
  _.isEmpty(await naclFile.elements()) && _.isEmpty(await naclFile.data.errors())
)

export const getFunctions = (staticFilesSource: StaticFilesSource): Functions => ({
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
  elementsIndex: await remoteMapCreator<string[]>({
    namespace: getRemoteMapNamespace('elements_index', sourceName),
    serialize: async val => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
    persistent,
  }),
  mergeErrors: await remoteMapCreator<MergeError[]>({
    namespace: getRemoteMapNamespace('errors', sourceName),
    serialize: errors => serialize(errors, 'keepRef'),
    deserialize: async data => deserializeMergeErrors(data),
    persistent,
  }),
  mergedElements: new RemoteElementSource(await remoteMapCreator<Element>({
    namespace: getRemoteMapNamespace('merged', sourceName),
    serialize: async element => serialize([element], 'keepRef'),
    deserialize: async data => deserializeSingleElement(
      data,
      async sf => staticFilesSource.getStaticFile(sf.filepath, sf.encoding)
    ),
    persistent,
  })),
  parsedNaclFiles: parsedNaclFiles ?? createParseResultCache(
    getRemoteMapNamespace('parsed_nacl_files', sourceName),
    remoteMapCreator,
    staticFilesSource,
    persistent
  ),
  referencedIndex: await remoteMapCreator<string[]>({
    namespace: getRemoteMapNamespace('referenced_index', sourceName),
    serialize: async val => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
    persistent,
  }),
  searchableNamesIndex: await remoteMapCreator<boolean>({
    namespace: getRemoteMapNamespace('searchableNamesIndex', sourceName),
    serialize: async val => (val === true ? '1' : '0'),
    deserialize: async data => data !== '0',
    persistent,
  }),
  staticFilesIndex: await remoteMapCreator<string[]>({
    namespace: getRemoteMapNamespace('static_files_index', sourceName),
    serialize: async val => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
    persistent,
  }),
  metadata: await remoteMapCreator<string>({
    namespace: getRemoteMapNamespace('metadata', sourceName),
    serialize: async val => val,
    deserialize: async data => data,
    persistent,
  }),
})

const buildNaclFilesState = async ({
  newNaclFiles, currentState,
}: {
  newNaclFiles: ParsedNaclFile[]
  currentState: NaclFilesState
}): Promise<buildNaclFilesStateResult> => {
  const preChangeHash = await currentState.metadata.get(HASH_KEY)
  const cacheValid = (preChangeHash === await currentState.parsedNaclFiles.getHash())
  log.debug('building elements indices for %d NaCl files', newNaclFiles.length)
  const newParsed = _.keyBy(newNaclFiles, parsed => parsed.filename)
  const elementsIndexAdditions: Record<string, Set<string>> = {}
  const referencedIndexAdditions: Record<string, Set<string>> = {}
  const staticFilesIndexAdditions: Record<string, Set<string>> = {}
  const elementsIndexDeletions: Record<string, Set<string>> = {}
  const referencedIndexDeletions: Record<string, Set<string>> = {}
  const staticFilesIndexDeletions: Record<string, Set<string>> = {}
  // We need to iterate over this twice - so no point in making this iterable :/
  const relevantElementIDs: ElemID[] = []
  const newElementsToMerge: AsyncIterable<Element>[] = []

  const updateIndex = async <T>(
    index: RemoteMap<T[]>,
    additions: Record<string, Set<T>>,
    deletions: Record<string, Set<T>>,
  ): Promise<void> => {
    const changedKeys = _.uniq(Object.keys(additions).concat(Object.keys(deletions)))
    const newEntries = await withLimitedConcurrency(changedKeys.map(key => async () => {
      const currentValues = (await index.get(key)) ?? []
      const keyDeletionsSet = deletions[key] ?? new Set()
      const keyAdditions = Array.from(additions[key]?.values() ?? [])
      const newValues = currentValues
        .filter(value => !keyDeletionsSet.has(value))
        .concat(keyAdditions)
      return { key, value: _.uniq(newValues) }
    }), UPDATE_INDEX_CONCURRENCY)
    const [entriesToSet, entriesToDelete] = _.partition(newEntries, e => e.value.length > 0)
    await index.deleteAll(awu(entriesToDelete).map(e => e.key))
    await index.setAll(awu(entriesToSet))
  }

  const updateSearchableNamesIndex = async (
    changes: Change[]
  ): Promise<void> => {
    const [additions, removals] = _.partition(changes.flatMap(change => {
      if (isModificationChange(change)) {
        if (isObjectTypeChange(change)) {
          const beforeFields = Object.values(change.data.before.fields)
          const afterFields = Object.values(change.data.after.fields)
          const additionFields = afterFields
            .filter(field => !beforeFields.find(f => f.elemID.isEqual(field.elemID)))
          const removalFields = beforeFields
            .filter(field => !afterFields.find(f => f.elemID.isEqual(field.elemID)))
          return [
            ...additionFields.map(f => toChange({ after: f })),
            ...removalFields.map(f => toChange({ before: f })),
          ]
        }
      }
      return change
    }).filter(change => !isModificationChange(change)),
    isAdditionChange)
    const additionsNames = _.uniq(additions.flatMap(getRelevantNamesFromChange))
    await currentState.searchableNamesIndex
      .setAll(additionsNames.map(name => ({ key: name, value: true })))
    const removalNames = _.uniq(removals.flatMap(getRelevantNamesFromChange))
    await currentState.searchableNamesIndex
      .deleteAll(removalNames)
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
    collections.set.difference(currentElemFullNamesSet, oldElemFullNamesSet)
      .forEach(fullName => {
        indexAdditions[fullName] = indexAdditions[fullName] ?? new Set<string>()
        indexAdditions[fullName].add(filename)
      })
    collections.set.difference(oldElemFullNamesSet, currentElemFullNamesSet)
      .forEach(fullName => {
        indexDeletions[fullName] = indexDeletions[fullName] ?? new Set<string>()
        indexDeletions[fullName].add(filename)
      })
  }

  const getNaclFile = async (file: ParsedNaclFile):
    Promise<ParsedNaclFile | undefined> => currentState.parsedNaclFiles.get(file.filename)

  const handleAdditionsOrModifications = (
    naclFiles: AwuIterable<ParsedNaclFile>
  ): Promise<void> => log.time(
    async () => {
      await naclFiles.forEach(async naclFile => {
        const parsedFile = (await getNaclFile(naclFile))
        log.trace('Updating indexes of %s nacl file: %s', !parsedFile ? 'added' : 'modified', naclFile.filename)
        updateIndexOfFile(
          referencedIndexAdditions,
          referencedIndexDeletions,
          naclFile.filename,
          await parsedFile?.data.referenced(),
          await naclFile.data.referenced(),
        )

        updateIndexOfFile(
          staticFilesIndexAdditions,
          staticFilesIndexDeletions,
          naclFile.filename,
          await parsedFile?.data.staticFiles(),
          await naclFile.data.staticFiles(),
        )

        const currentNaclFileElements = (await naclFile.elements()) ?? []
        const oldNaclFileElements = await parsedFile?.elements() ?? []
        updateIndexOfFile(
          elementsIndexAdditions,
          elementsIndexDeletions,
          naclFile.filename,
          oldNaclFileElements.map(e => e.elemID.getFullName()),
          currentNaclFileElements.map(e => e.elemID.getFullName()),
        )
        relevantElementIDs.push(
          ...currentNaclFileElements.map(e => e.elemID),
          ...oldNaclFileElements.map(e => e.elemID),
        )
        if (!_.isEmpty(currentNaclFileElements)) {
          newElementsToMerge.push(awu(currentNaclFileElements as Element[]))
        }
        // This is temp and should be removed when we change the init flow
        // This happens now cause we get here with ParsedNaclFiles that originate from the cache
        if (values.isDefined(naclFile.buffer)) {
          await currentState.parsedNaclFiles.put(naclFile.filename, naclFile)
        }
        log.trace('Finished updating indexes of %s', naclFile.filename)
      })
    },
    'handle additions/modifications of nacl files',
  )

  const handleDeletions = (naclFiles: AwuIterable<ParsedNaclFile>): Promise<void> => log.time(
    async () => {
      const toDelete: string[] = []
      await naclFiles.forEach(async naclFile => {
        const oldNaclFile = await getNaclFile(naclFile)
        if (oldNaclFile === undefined) {
          return
        }
        log.trace('Updating indexes of deleted nacl file: %s', naclFile.filename)
        const oldNaclFileReferenced = await oldNaclFile.data.referenced()
        oldNaclFileReferenced.forEach((elementFullName: string) => {
          referencedIndexDeletions[elementFullName] = referencedIndexDeletions[elementFullName]
            ?? new Set<string>()
          referencedIndexDeletions[elementFullName].add(oldNaclFile.filename)
        })
        const oldNaclFileElements = await oldNaclFile.elements() ?? []
        oldNaclFileElements.forEach(element => {
          const elementFullName = element.elemID.getFullName()
          elementsIndexDeletions[elementFullName] = elementsIndexDeletions[elementFullName]
            ?? new Set<string>()
          elementsIndexDeletions[elementFullName].add(oldNaclFile.filename)
        })
        relevantElementIDs.push(...oldNaclFileElements.map(e => e.elemID))
        toDelete.push(naclFile.filename)
        log.trace('Finished updating indexes of %s', naclFile.filename)
      })
      await currentState.parsedNaclFiles.deleteAll(toDelete)
    },
    'handle deletions of nacl files',
  )

  await handleDeletions(
    awu(Object.values(newParsed)).filter(isEmptyNaclFile)
  )
  await handleAdditionsOrModifications(
    awu(Object.values(newParsed)).filter(async naclFile => !(await isEmptyNaclFile(naclFile)))
  )

  const unmodifiedFragments = awu(_.uniqBy(relevantElementIDs, e => e.getFullName()))
    .flatMap(async elemID => {
      const unmodifiedFilesWithElem = (
        await currentState.elementsIndex.get(elemID.getFullName()) ?? []
      ).filter((filename: string) => newParsed[filename] === undefined)

      return awu(unmodifiedFilesWithElem)
        .map(async filename =>
          ((await (await currentState.parsedNaclFiles.get(filename)).elements()) ?? []).find(
            e => e.elemID.isEqual(elemID)
          ))
    }).filter(values.isDefined) as AsyncIterable<Element>
  const changes = await buildNewMergedElementsAndErrors({
    afterElements: awu(newElementsToMerge).flat().concat(unmodifiedFragments),
    relevantElementIDs: awu(relevantElementIDs),
    currentElements: currentState.mergedElements,
    currentErrors: currentState.mergeErrors,
    mergeFunc: elements => mergeElements(elements),
  }) as Change[]
  const postChangeHash = await currentState.parsedNaclFiles.getHash()
  await Promise.all([
    updateIndex(
      currentState.elementsIndex,
      elementsIndexAdditions,
      elementsIndexDeletions
    ),
    updateIndex(
      currentState.referencedIndex,
      referencedIndexAdditions,
      referencedIndexDeletions
    ),
    updateIndex(
      currentState.staticFilesIndex,
      staticFilesIndexAdditions,
      staticFilesIndexDeletions
    ),
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

const buildNaclFilesSource = (
  sourceName: string,
  naclFilesStore: DirectoryStore<string>,
  staticFilesSource: StaticFilesSource,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
  initState?: Promise<NaclFilesState>,
): NaclFilesSource => {
  const functions: Functions = getFunctions(staticFilesSource)

  let state = initState
  let initChanges: ChangeSet<Change> | undefined

  const getState = (): Promise<NaclFilesState> => {
    if (_.isUndefined(state)) {
      throw new Error('can not get state before load was invoked')
    }
    return state
  }

  const buildInitState = async (
    ignoreFileChanges = false,
  ): Promise<buildNaclFilesStateResult> => {
    const currentState = await createNaclFilesState(
      remoteMapCreator,
      staticFilesSource,
      sourceName,
      persistent
    )
    if (!ignoreFileChanges) {
      const preChangeHash = await currentState.parsedNaclFiles.getHash()
      const cacheFilenames = await currentState.parsedNaclFiles.list()
      const modifiedStaticFiles = await staticFilesSource.load?.() ?? []
      const naclFilenames = new Set(await naclFilesStore.list())
      const fileNames = new Set()
      const modifiedNaclFiles: NaclFile[] = []
      const naclReferencingModifiedStaticFiles = new Set(
        (await currentState.staticFilesIndex.getMany(modifiedStaticFiles))
          .filter(values.isDefined)
          .flat()
      )
      await withLimitedConcurrency(
        cacheFilenames.map(filename => async () => {
          const naclFile = (naclFilenames.has(filename) && await naclFilesStore.get(filename))
            || { filename, buffer: '' }
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
            modifiedNaclFiles.push(await naclFilesStore.get(filename) ?? { filename, buffer: '' })
          }
          fileNames.add(filename)
        }),
        CACHE_READ_CONCURRENCY,
      )
      const parsedModifiedFiles = await parseNaclFiles(
        modifiedNaclFiles,
        functions,
      )
      const result = await buildNaclFilesState({
        newNaclFiles: parsedModifiedFiles,
        currentState,
      })
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
    parsedNaclFiles: ParsedNaclFile[] = [],
    ignoreFileChanges = false,
  ):
  Promise<buildNaclFilesStateResult> => {
    if (_.isUndefined(state)) {
      return buildInitState(ignoreFileChanges)
    }
    const current = await state
    return buildNaclFilesState({
      newNaclFiles: parsedNaclFiles,
      currentState: current,
    })
  }

  const getNaclFile = (filename: string): Promise<NaclFile | undefined> =>
    naclFilesStore.get(filename)

  const getParsedNaclFile = async (filename: string): Promise<ParsedNaclFile | undefined> => {
    const addPathParsedNaclFileElements = (parsed: ParsedNaclFile): ParsedNaclFile => ({
      ...parsed,
      elements: async () => {
        const parsedElement = await parsed.elements()
        return parsedElement && parsedElement.map(elem => {
          elem.path = toPathHint(filename)
          return elem
        })
      },
    })

    // We don't want to parse all nacl files here when we want only parsedResult of one file.
    if (state !== undefined) {
      return addPathParsedNaclFileElements(
        await (await getState()).parsedNaclFiles.get(filename)
      )
    }
    const naclFile = await getNaclFile(filename)
    if (naclFile === undefined) return undefined
    return addPathParsedNaclFileElements(
      await toParsedNaclFile(naclFile, await parseNaclFile(naclFile, functions))
    )
  }

  const getElementNaclFiles = async (elemID: ElemID): Promise<string[]> => {
    const topLevelID = elemID.createTopLevelParentID()
    const topLevelFiles = await (await getState()).elementsIndex.get(
      topLevelID.parent.getFullName()
    ) ?? []
    if (elemID.isTopLevel()) {
      return topLevelFiles
    }
    return (await Promise.all(topLevelFiles.map(async filename => {
      const fragments = await (await (await getState()).parsedNaclFiles.get(filename)).elements()
      return wu(fragments ?? []).some(fragment => resolvePath(fragment, elemID) !== undefined)
        ? filename
        : undefined
    }))).filter(values.isDefined)
  }

  const getElementReferencedFiles = async (
    elemID: ElemID
  ): Promise<string[]> => await (await getState()).referencedIndex.get(elemID.getFullName()) ?? []

  const getSourceMap = async (filename: string, useCache = true): Promise<SourceMap> => {
    if (useCache) {
      const parsedNaclFile = await (await getState()).parsedNaclFiles.get(filename)
      const naclFileSourceMap = await parsedNaclFile.sourceMap?.()
      if (values.isDefined(naclFileSourceMap)) {
        return naclFileSourceMap
      }
    }
    const naclFile = (await naclFilesStore.get(filename))
    if (_.isUndefined(naclFile)) {
      log.error('failed to find %s in NaCl file store', filename)
      return new SourceMap()
    }
    const parsedResult = await parseNaclFile(naclFile, functions)
    if (useCache) {
      const newParsedNaclFile = await toParsedNaclFile(naclFile, parsedResult)
      await (await getState()).parsedNaclFiles.put(filename, newParsedNaclFile)
    }
    return parsedResult.sourceMap
  }

  const createNaclFileFromChange = async (
    filename: string,
    change: AdditionDiff<Element>,
    fileData: string,
  ): Promise<ParsedNaclFile> => {
    const elements = [change.data.after]
    let referenced: string[]
    let staticFiles: string[]
    const loadRefs = async (): Promise<void> => {
      if (referenced === undefined || staticFiles === undefined) {
        const referencedAndStaticFiles = await getElementsReferencedAndStaticFiles(elements)
        referenced = Array.from(referencedAndStaticFiles.referenced)
        staticFiles = Array.from(referencedAndStaticFiles.staticFiles)
      }
    }
    return {
      filename,
      elements: () => Promise.resolve(elements),
      data: {
        errors: () => Promise.resolve([]),
        referenced: async () => {
          await loadRefs()
          return referenced
        },
        staticFiles: async () => {
          await loadRefs()
          return staticFiles
        },
      },
      buffer: fileData,
    }
  }

  const setNaclFiles = async (
    naclFiles: NaclFile[]
  ): Promise<void> => {
    const [emptyNaclFiles, nonEmptyNaclFiles] = _.partition(
      naclFiles,
      naclFile => _.isEmpty(naclFile.buffer.trim())
    )
    await awu(nonEmptyNaclFiles).forEach(naclFile => naclFilesStore.set(naclFile))
    await awu(emptyNaclFiles).forEach(naclFile => naclFilesStore.delete(naclFile.filename))
  }

  const groupChangesByFilename = async (
    changes: DetailedChange[]
  ): Promise<Record<string, DetailedChangeWithSource[]>> => {
    const naclFiles = _.uniq(
      await awu(changes).map(change => change.id)
        .flatMap(elemID => getElementNaclFiles(elemID.createTopLevelParentID().parent))
        .toArray()
    )

    const { parsedNaclFiles } = await getState()
    log.debug('Nacl source %s getting source maps for %d nacl files', sourceName, naclFiles.length)
    const changedFileSourceMaps = (
      await withLimitedConcurrency(
        naclFiles.map(naclFile => async () => {
          const parsedNaclFile = await parsedNaclFiles.get(naclFile)
          return values.isDefined(parsedNaclFile)
            ? getSourceMap(parsedNaclFile.filename, false)
            : undefined
        }),
        CACHE_READ_CONCURRENCY,
      )
    ).filter(values.isDefined)

    const mergedSourceMap = changedFileSourceMaps.reduce(
      (acc, sourceMap) => {
        acc.merge(sourceMap)
        return acc
      },
      new SourceMap(),
    )
    const changesWithLocation = getChangesToUpdate(changes, mergedSourceMap)
      .flatMap(change => getChangeLocations(change, mergedSourceMap))

    return _.groupBy(
      changesWithLocation,
      // Group changes file, we use lower case in order to support case insensitive file systems
      change => change.location.filename.toLowerCase(),
    )
  }

  const updateNaclFiles = async (changes: DetailedChange[]): Promise<ChangeSet<Change>> => {
    const preChangeHash = await (await state)?.parsedNaclFiles.getHash()
    const getNaclFileData = async (filename: string): Promise<string> => {
      const naclFile = await naclFilesStore.get(filename)
      return naclFile ? naclFile.buffer : ''
    }

    // This method was written with the assumption that each static file is pointed by no more
    // then one value in the nacls. A ticket was open to fix that (SALTO-954)
    const removeDanglingStaticFiles = async (fileChanges: DetailedChange[]): Promise<void> => {
      fileChanges
        .filter(change => change.action === 'remove')
        .map(getChangeData)
        .map(getNestedStaticFiles)
        .flat()
        .forEach(file => staticFilesSource.delete(file))
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
    const updatedNaclFiles = (await withLimitedConcurrency(
      Object.entries(changesByFileName)
        .map(([lowerCaseFilename, fileChanges]) => async ():
          Promise<ParsedNaclFile & NaclFile | undefined> => {
          // Changes might have a different cased filename, we take the version that already exists
          // or the first variation if this is a new file
          const filename = (
            allFileNames[lowerCaseFilename]
            ?? fileChanges.map(change => change.location.filename).sort()[0]
          )
          try {
            const naclFileData = await getNaclFileData(filename)
            log.trace('Nacl source %s starting to update file %s with %d changes', sourceName, filename, fileChanges.length)
            const buffer = await updateNaclFileData(naclFileData, fileChanges, functions)
            const shouldNotParse = _.isEmpty(naclFileData)
              && fileChanges.length === 1
              && fileChanges[0].action === 'add'
              && isElement(fileChanges[0].data.after)
            const parsed = shouldNotParse
              ? await createNaclFileFromChange(filename, fileChanges[0] as AdditionDiff<Element>,
                buffer)
              : await toParsedNaclFile(
                { filename, buffer },
                await parse(Buffer.from(buffer), filename, functions, false),
              )
            if (((await parsed.data.errors()) ?? []).length > 0) {
              logNaclFileUpdateErrorContext(filename, fileChanges, naclFileData, buffer)
            }
            await removeDanglingStaticFiles(fileChanges)
            log.trace('Nacl source %s finished updating file %s with %d changes', sourceName, filename, fileChanges.length)
            const { data, elements } = parsed
            return { filename, elements, data, buffer }
          } catch (e) {
            log.error('failed to update NaCl file %s due to %o with %o changes',
              filename, e, fileChanges)
            return undefined
          }
        }),
      DUMP_CONCURRENCY
    )).filter(values.isDefined)

    if (updatedNaclFiles.length > 0) {
      log.debug('going to update %d NaCl files', updatedNaclFiles.length)
      // The map is to avoid saving unnecessary fields in the nacl files
      await setNaclFiles(
        updatedNaclFiles.map(file => _.pick(file, ['buffer', 'filename']))
      )
      const res = await buildNaclFilesStateInner(updatedNaclFiles)
      state = Promise.resolve(res.state)
      res.changes.preChangeHash = preChangeHash
      res.changes.postChangeHash = await ((await state).parsedNaclFiles.getHash())
      return res.changes
    }
    return { changes: [],
      cacheValid: true,
      preChangeHash,
      postChangeHash: await ((await state)?.parsedNaclFiles.getHash()) }
  }

  return {
    list: async (): Promise<AsyncIterable<ElemID>> =>
      awu((await getState()).elementsIndex.keys()).map(name => ElemID.fromFullName(name)),
    has: async (id: ElemID): Promise<boolean> => (await getState()).mergedElements.has(id),
    delete: async (id: ElemID): Promise<void> => (await getState()).mergedElements.delete(id),
    deleteAll: async (ids: ThenableIterable<ElemID>): Promise<void> => (await getState())
      .mergedElements.deleteAll(ids),
    set: async (element: Element): Promise<void> => (await getState()).mergedElements.set(element),
    setAll: async (elements: ThenableIterable<Element>): Promise<void> => (await getState())
      .mergedElements.setAll(elements),
    get: async (id: ElemID): Promise<Element | Value> => {
      const currentState = await getState()
      const { parent, path } = id.createTopLevelParentID()
      const baseElement = await currentState.mergedElements.get(parent)
      return baseElement && !_.isEmpty(path) ? resolvePath(baseElement, id) : baseElement
    },
    getAll: async (): Promise<AsyncIterable<Element>> => (
      (await getState()).mergedElements.getAll()
    ),

    flush: async (): Promise<void> => {
      await naclFilesStore.flush()
      await staticFilesSource.flush()
      const currentState = await getState()
      await currentState.elementsIndex.flush()
      await currentState.mergeErrors.flush()
      await currentState.mergedElements.flush()
      await currentState.referencedIndex.flush()
      await currentState.parsedNaclFiles.flush()
      await currentState.searchableNamesIndex.flush()
      await currentState.staticFilesIndex.flush()
      await currentState.metadata.flush()
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
      const sourceRanges = await withLimitedConcurrency(naclFiles
        .map(naclFile => async () => (await getSourceMap(naclFile))
          .get(elemID.getFullName()) || []),
      CACHE_READ_CONCURRENCY)
      return _.flatten(sourceRanges)
    },

    removeNaclFiles: async (names: string[]) => {
      const preChangeHash = await (await getState()).parsedNaclFiles.getHash()
      await awu(names).forEach(name => naclFilesStore.delete(name))
      const res = await buildNaclFilesStateInner(
        await parseNaclFiles(names.map(filename => ({ filename, buffer: '' })), functions),
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
        await currentState.referencedIndex.clear()
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
        currentState.parsedNaclFiles
      )
      await newCurrentState.mergedElements.setAll(await currentState.mergedElements.getAll())
      await currentState.mergedElements.clear()
      await newCurrentState.elementsIndex.setAll(
        currentState.elementsIndex.entries()
      )
      await currentState.elementsIndex.clear()
      await newCurrentState.mergeErrors.setAll(
        currentState.mergeErrors.entries()
      )
      await currentState.mergeErrors.clear()
      await newCurrentState.referencedIndex.setAll(
        currentState.referencedIndex.entries()
      )
      await currentState.referencedIndex.clear()
      await newCurrentState.metadata.setAll(
        currentState.metadata.entries()
      )
      await currentState.metadata.clear()
      await newCurrentState.searchableNamesIndex.setAll(
        currentState.searchableNamesIndex.entries()
      )
      await currentState.searchableNamesIndex.clear()
      state = Promise.resolve(newCurrentState)
    },

    clone: () => buildNaclFilesSource(
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
      const res = await buildNaclFilesStateInner(
        await parseNaclFiles(naclFiles, functions)
      )
      state = Promise.resolve(res.state)
      return res.changes
    },
    getSourceMap,
    getElementNaclFiles,
    getElementReferencedFiles,
    getElementFileNames: async () => {
      const { elementsIndex } = await getState()
      const elementsIndexEntries = await awu(elementsIndex.entries()).groupBy(entry => entry.key)
      return new Map(Object.entries(
        _.mapValues(
          elementsIndexEntries,
          entries => entries.flatMap(entry => entry.value)
        )
      ))
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
      (awu((await getState())?.searchableNamesIndex?.keys() ?? []).toArray()),
    getStaticFile: async (filePath, encoding) => {
      const staticFile = await staticFilesSource.getStaticFile(filePath, encoding)
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
  parsedFiles?: ParsedNaclFile[],
): Promise<NaclFilesSource> => {
  const state = (parsedFiles !== undefined)
    ? (await buildNaclFilesState({
      newNaclFiles: parsedFiles,
      currentState: await createNaclFilesState(
        remoteMapCreator,
        staticFilesSource,
        sourceName,
        persistent
      ),
    })).state
    : undefined
  return buildNaclFilesSource(
    sourceName,
    naclFilesStore,
    staticFilesSource,
    remoteMapCreator,
    persistent,
    state !== undefined ? Promise.resolve(state) : undefined,
  )
}
