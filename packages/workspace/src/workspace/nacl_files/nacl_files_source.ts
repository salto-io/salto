/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element, ElemID, Value, DetailedChange, isElement, getChangeElement, isObjectType,
  isInstanceElement, isIndexPathPart, isReferenceExpression, isContainerType, isVariable, Change,
  placeholderReadonlyElementsSource } from '@salto-io/adapter-api'
import { resolvePath, TransformFuncArgs, transformElement, safeJsonStringify } from '@salto-io/adapter-utils'
import { promises, values, collections } from '@salto-io/lowerdash'
import { AdditionDiff } from '@salto-io/dag'
import { MergeError, mergeElements } from '../../merger'
import { getChangeLocations, updateNaclFileData, getChangesToUpdate, DetailedChangeWithSource,
  getNestedStaticFiles } from './nacl_file_update'
import { parse, SourceRange, ParseResult, SourceMap } from '../../parser'
import { ElementsSource, RemoteElementSource } from '../elements_source'
import { DirectoryStore } from '../dir_store'
import { Errors } from '../errors'
import { StaticFilesSource } from '../static_files'
import { getStaticFilesFunctions } from '../static_files/functions'
import { buildNewMergedElementsAndErrors } from './elements_cache'
import { serialize, deserializeMergeErrors, deserializeSingleElement } from '../../serializer/elements'
import { Functions } from '../../parser/functions'
import { RemoteMap, RemoteMapCreator } from '../remote_map'
import { ParsedNaclFile } from './parsed_nacl_file'
import { ParsedNaclFileCache, ParseResultKey } from './parsed_nacl_files_cache'

const { awu, concatAsync } = collections.asynciterable
const { withLimitedConcurrency } = promises.array

const log = logger(module)

export type RoutingMode = 'isolated' | 'default' | 'align' | 'override'

export const FILE_EXTENSION = '.nacl'
const PARSE_CONCURRENCY = 100
const DUMP_CONCURRENCY = 100
// TODO: this should moved into cache implemenation
const CACHE_READ_CONCURRENCY = 100

export type NaclFile = {
  buffer: string
  filename: string
  timestamp?: number
}

export type NaclFilesSource = Omit<ElementsSource, 'clear'> & {
  updateNaclFiles: (changes: DetailedChange[], mode?: RoutingMode) => Promise<Change[]>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
  getElementReferencedFiles: (id: ElemID) => Promise<string[]>
  // TODO: this should be for single?
  setNaclFiles: (...naclFiles: NaclFile[]) => Promise<Change[]>
  removeNaclFiles: (...names: string[]) => Promise<Change[]>
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
  getElementsSource: () => Promise<ElementsSource>
  load: () => Promise<Change[]>
}

type NaclFilesState = {
  parsedNaclFiles: ParsedNaclFileCache
  elementsIndex: RemoteMap<string[]>
  mergedElements: ElementsSource
  mergeErrors: RemoteMap<MergeError[]>
  referencedIndex: RemoteMap<string[]>
}

const cacheResultKey = (naclFile: { filename: string; timestamp?: number; buffer?: string }):
 ParseResultKey => ({
  filename: naclFile.filename,
  lastModified: naclFile.timestamp ?? Date.now(),
  buffer: naclFile.buffer,
})

const getRemoteMapNamespace = (
  namespace: string, name: string
): string => `naclFileSource-${name}-${namespace}`

const getInnerTypePrefixStartIndex = (fullName: string): number => {
  const nestedMap = fullName.lastIndexOf('Map<')
  const nestedList = fullName.lastIndexOf('List<')
  if (nestedList > nestedMap) {
    return nestedList + 'List<'.length
  }
  if (nestedMap > nestedList) {
    return nestedMap + 'Map<'.length
  }
  return -1
}
// This assumes List</Map< will only be in container types' ElemID and that they have closing >
const getTypeOrContainerTypeID = (elemID: ElemID): ElemID => {
  const fullName = elemID.getFullName()
  const deepInnerTypeStart = getInnerTypePrefixStartIndex(fullName)
  const deepInnerTypeEnd = fullName.indexOf('>')
  if (deepInnerTypeStart === -1 && deepInnerTypeEnd === -1) {
    return elemID
  }
  if (deepInnerTypeStart === -1 || deepInnerTypeEnd < deepInnerTypeStart) {
    throw new Error(`Invalid < > structure in ElemID - ${fullName}`)
  }
  return ElemID.fromFullName(fullName.slice(
    deepInnerTypeStart,
    deepInnerTypeEnd
  ))
}

const getElementReferenced = async (element: Element): Promise<Set<string>> => {
  const referenced = new Set<string>()
  const transformFunc = ({ value, field, path }: TransformFuncArgs): Value => {
    if (field && path && !isIndexPathPart(path.name)) {
      referenced.add(getTypeOrContainerTypeID(field.refType.elemID).getFullName())
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
    return value
  }

  if (isObjectType(element)) {
    Object.values(element.fields)
      .map(field => getTypeOrContainerTypeID(field.refType.elemID))
      .forEach(id => referenced.add(id.getFullName()))
  }
  if (isInstanceElement(element)) {
    referenced.add(element.refType.elemID.getFullName())
  }
  Object.values(element.annotationRefTypes)
    .map(anno => getTypeOrContainerTypeID(anno.elemID))
    .forEach(id => referenced.add(id.getFullName()))
  if (!isContainerType(element) && !isVariable(element)) {
    await transformElement({
      element,
      transformFunc,
      strict: false,
      elementsSource: placeholderReadonlyElementsSource,
    })
  }
  return referenced
}

export const toParsedNaclFile = async (
  naclFile: NaclFile,
  parseResult: ParseResult
): Promise<ParsedNaclFile> => ({
  filename: naclFile.filename,
  elements: await awu(parseResult.elements).toArray(),
  data: {
    timestamp: naclFile.timestamp ?? Date.now(),
    errors: parseResult.errors,
    referenced: await awu(parseResult.elements).flatMap(getElementReferenced).toArray(),
  },
  buffer: naclFile.buffer,
  sourceMap: parseResult.sourceMap,
})

const parseNaclFile = async (
  naclFile: NaclFile, functions: Functions
): Promise<Required<ParseResult>> =>
  (parse(Buffer.from(naclFile.buffer), naclFile.filename, functions))

const parseNaclFiles = async (
  naclFiles: NaclFile[], cache: ParsedNaclFileCache, functions: Functions
): Promise<ParsedNaclFile[]> =>
  withLimitedConcurrency(naclFiles.map(naclFile => async () => {
    const hasValid = await cache.hasValid(cacheResultKey(naclFile))
    const cachedResult = hasValid && await cache.get(naclFile.filename)
    return (cachedResult && values.isDefined(cachedResult))
      ? cachedResult : toParsedNaclFile(naclFile, await parseNaclFile(naclFile, functions))
  }), PARSE_CONCURRENCY)

export const getFunctions = (staticFilesSource: StaticFilesSource): Functions => ({
  ...getStaticFilesFunctions(staticFilesSource), // add future functions here
})

export const getParsedNaclFiles = async (
  naclFilesStore: DirectoryStore<string>,
  cache: ParsedNaclFileCache,
  staticFilesSource: StaticFilesSource
): Promise<ParsedNaclFile[]> => {
  const naclFiles = (await naclFilesStore.getFiles(await naclFilesStore.list()))
    .filter(values.isDefined)
  const functions = getFunctions(staticFilesSource)
  return parseNaclFiles(naclFiles, cache, functions)
}

type buildNaclFilesStateResult = { state: NaclFilesState; changes: Change[] }

const createNaclFilesState = async (
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
  sourceName: string,
  cache: ParsedNaclFileCache,
): Promise<NaclFilesState> => ({
  elementsIndex: await remoteMapCreator<string[]>({
    namespace: getRemoteMapNamespace('elements_index', sourceName),
    serialize: val => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
  }),
  mergeErrors: await remoteMapCreator<MergeError[]>({
    namespace: getRemoteMapNamespace('errors', sourceName),
    serialize: errors => serialize(errors),
    deserialize: async data => deserializeMergeErrors(data),
  }),
  mergedElements: new RemoteElementSource(await remoteMapCreator<Element>({
    namespace: getRemoteMapNamespace('merged', sourceName),
    serialize: element => serialize([element]),
    deserialize: async data => deserializeSingleElement(
      data,
      async sf => staticFilesSource.getStaticFile(sf.filepath, sf.encoding)
    ),
  })),
  parsedNaclFiles: cache,
  referencedIndex: await remoteMapCreator<string[]>({
    namespace: getRemoteMapNamespace('referenced_index', sourceName),
    serialize: val => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
  }),
})

const buildNaclFilesState = async ({
  newNaclFiles, currentState,
}: {
  newNaclFiles: ParsedNaclFile[]
  currentState: NaclFilesState
}): Promise<buildNaclFilesStateResult> => {
  log.debug('building elements indices for %d NaCl files', newNaclFiles.length)
  const newParsed = _.keyBy(newNaclFiles, parsed => parsed.filename)

  const elementsIndexAdditions: Record<string, Set<string>> = {}
  const referencedIndexAdditions: Record<string, Set<string>> = {}
  const elementsIndexDeletions: Record<string, Set<string>> = {}
  const referencedIndexDeletions: Record<string, Set<string>> = {}
  // We need to iterate over this twice - so no point in making this iterable :/
  const relevantElementIDs: ElemID[] = []
  const newElementsToMerge: AsyncIterable<Element>[] = []

  const updateIndex = async <T>(
    index: RemoteMap<T[]>,
    additions: Record<string, Set<T>>,
    deletions: Record<string, Set<T>>,
  ): Promise<void> => {
    const changedKeys = _.uniq(Object.keys(additions).concat(Object.keys(deletions)))
    return index.setAll(awu(changedKeys).map(async key => {
      const currentValues = (await index.get(key)) ?? []
      const keyDeletionsSet = deletions[key] ?? new Set()
      const keyAdditions = Array.from(additions[key]?.values() ?? [])
      const newValues = currentValues
        .filter(value => !keyDeletionsSet.has(value))
        .concat(keyAdditions)
      return { key, value: _.uniq(newValues) }
    }))
  }

  const handleAdditionOrModification = async (naclFile: ParsedNaclFile): Promise<void> => {
    (naclFile.data.referenced ?? []).forEach((elementFullName: string) => {
      referencedIndexAdditions[elementFullName] = referencedIndexAdditions[elementFullName]
        ?? new Set<string>()
      referencedIndexAdditions[elementFullName].add(naclFile.filename)
    })
    await awu(naclFile.elements).forEach(element => {
      const elementFullName = element.elemID.getFullName()
      elementsIndexAdditions[elementFullName] = elementsIndexAdditions[elementFullName]
        ?? new Set<string>()
      elementsIndexAdditions[elementFullName].add(naclFile.filename)
    })
    relevantElementIDs.push(
      ...naclFile.elements.map(e => e.elemID),
      ...(await currentState.parsedNaclFiles.get(naclFile.filename))?.elements
        .map(e => e.elemID) ?? [],
    )

    newElementsToMerge.push(awu(naclFile.elements))
    // This is temp and should be removed when we change the init flow
    // This happens now cause we get here with ParsedNaclFiles that originate from the cache
    if (values.isDefined(naclFile.buffer)) {
      await currentState.parsedNaclFiles.put(naclFile.filename, naclFile)
    }
  }

  const handleDeletion = async (naclFile: ParsedNaclFile): Promise<void> => {
    const oldNaclFile = await currentState.parsedNaclFiles.get(naclFile.filename)
    if (oldNaclFile === undefined) {
      return
    }
    (oldNaclFile.data.referenced ?? []).forEach((elementFullName: string) => {
      referencedIndexDeletions[elementFullName] = referencedIndexDeletions[elementFullName]
        ?? new Set<string>()
      referencedIndexDeletions[elementFullName].add(oldNaclFile.filename)
    })
    await awu(oldNaclFile.elements).forEach(element => {
      const elementFullName = element.elemID.getFullName()
      elementsIndexDeletions[elementFullName] = elementsIndexDeletions[elementFullName]
        ?? new Set<string>()
      elementsIndexDeletions[elementFullName].add(oldNaclFile.filename)
    })
    relevantElementIDs.push(...oldNaclFile.elements.map(e => e.elemID))
    await currentState.parsedNaclFiles.delete(naclFile.filename)
  }

  // Add data from new additions
  await awu(Object.values(newParsed)).forEach(async naclFile => {
    const isDeletion = _.isEmpty(naclFile.elements) && _.isEmpty(naclFile.data.errors)
    if (isDeletion) {
      await handleDeletion(naclFile)
    } else {
      await handleAdditionOrModification(naclFile)
    }
  })


  const unmodifiedFragments = awu(_.uniqBy(relevantElementIDs, e => e.getFullName()))
    .flatMap(async elemID => {
      const unmodifiedFilesWithElem = (
        await currentState.elementsIndex.get(elemID.getFullName()) ?? []
      ).filter((filename: string) => newParsed[filename] === undefined)

      return awu(unmodifiedFilesWithElem)
        .map(async filename =>
          (await currentState.parsedNaclFiles.get(filename))?.elements.find(
            e => e.elemID.isEqual(elemID)))
    }).filter(values.isDefined) as AsyncIterable<Element>

  await updateIndex(
    currentState.elementsIndex,
    elementsIndexAdditions,
    elementsIndexDeletions
  )
  await updateIndex(
    currentState.referencedIndex,
    referencedIndexAdditions,
    referencedIndexDeletions
  )
  const changes = await buildNewMergedElementsAndErrors({
    newElements: concatAsync(...newElementsToMerge, unmodifiedFragments),
    relevantElementIDs: awu(relevantElementIDs),
    currentElements: currentState.mergedElements,
    currentErrors: currentState.mergeErrors,
    mergeFunc: elements => mergeElements(elements),
  }) as Change[]
  return {
    state: currentState,
    changes,
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
  cache: ParsedNaclFileCache,
  staticFilesSource: StaticFilesSource,
  remoteMapCreator: RemoteMapCreator,
  initState?: Promise<NaclFilesState>,
): NaclFilesSource => {
  const functions: Functions = getFunctions(staticFilesSource)

  let state = initState
  const getState = (): Promise<NaclFilesState> => {
    if (_.isUndefined(state)) {
      throw new Error('can not get state before load was invoked')
    }
    return state
  }

  const buildInitState = async (): Promise<buildNaclFilesStateResult> => {
    const modifiedNaclFiles: NaclFile[] = []
    const parsedNaclFilesFromCache: ParsedNaclFile[] = []
    // The sourceName '' is a temp hack in the whole flow
    // TODO: ROI REMOVE THESE HACKS PLEASE!
    if (sourceName === '') {
      await cache.clear()
    }
    const cacheFilenames = await cache.list()
    const naclFilenames = await naclFilesStore.list()

    const fileNames = new Set([...cacheFilenames, ...naclFilenames])
    await awu(fileNames).forEach(async filename => {
      const naclFile = await naclFilesStore.get(filename) ?? { filename, buffer: '' }
      const cacheVal = await cache.get(filename)
      if (cacheVal !== undefined && sourceName !== '') {
        parsedNaclFilesFromCache.push(cacheVal)
      }
      const cacheHasValidVal = await cache.hasValid(cacheResultKey(naclFile))
      if (!cacheHasValidVal || sourceName === '') {
        modifiedNaclFiles.push(naclFile)
      }
    })
    const cacheOnlyState = (await buildNaclFilesState({
      newNaclFiles: parsedNaclFilesFromCache,
      currentState: await createNaclFilesState(
        remoteMapCreator,
        staticFilesSource,
        sourceName,
        cache
      ),
    })).state
    if (sourceName === '') {
      cacheOnlyState.mergedElements.clear()
    }
    const parsedModifiedFiles = await parseNaclFiles(modifiedNaclFiles, cache, functions)
    return buildNaclFilesState({
      newNaclFiles: parsedModifiedFiles,
      currentState: cacheOnlyState,
    })
  }

  const buildNaclFilesStateInner = async (parsedNaclFiles: ParsedNaclFile[] = []):
  Promise<buildNaclFilesStateResult> => {
    if (_.isUndefined(state)) {
      return buildInitState()
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
    // We don't want to parse all nacl files here when we want only parsedResult of one file.
    if (state !== undefined) {
      return (await getState()).parsedNaclFiles.get(filename)
    }
    const naclFile = await getNaclFile(filename)
    if (naclFile === undefined) return undefined
    return (await parseNaclFiles([naclFile], cache, functions))[0]
  }

  const getElementNaclFiles = async (elemID: ElemID): Promise<string[]> => {
    const topLevelID = elemID.createTopLevelParentID()
    const topLevelFiles = await (await getState()).elementsIndex.get(
      topLevelID.parent.getFullName()
    ) ?? []
    return (await Promise.all(topLevelFiles.map(async filename => {
      const fragments = (await getParsedNaclFile(filename))?.elements ?? []
      return values.isDefined(
        await awu(fragments).find(fragment => resolvePath(fragment, elemID) !== undefined)
      ) ? filename : undefined
    }))).filter(values.isDefined)
  }

  const getElementReferencedFiles = async (
    elemID: ElemID
  ): Promise<string[]> => await (await getState()).referencedIndex.get(elemID.getFullName()) ?? []

  const getSourceMap = async (filename: string): Promise<SourceMap> => {
    // Need to check if need an extra hasValid check here
    const parsedNaclFile = await (await getState()).parsedNaclFiles.get(filename)
    if (values.isDefined(parsedNaclFile) && values.isDefined(parsedNaclFile.sourceMap)) {
      return parsedNaclFile.sourceMap
    }
    const naclFile = (await naclFilesStore.get(filename))
    if (_.isUndefined(naclFile)) {
      log.error('failed to find %s in NaCl file store', filename)
      return new SourceMap()
    }
    const parsedResult = await parseNaclFile(naclFile, functions)
    const newParsedNaclFile = await toParsedNaclFile(naclFile, parsedResult)
    await cache.put(filename, newParsedNaclFile)
    return parsedResult.sourceMap
  }

  const createNaclFileFromChange = async (
    filename: string,
    change: AdditionDiff<Element>,
    fileData: string,
  ): Promise<ParsedNaclFile> => {
    const elements = [
      (change as AdditionDiff<Element>).data.after,
    ]
    const parsed = {
      filename,
      elements,
      data: {
        timestamp: Date.now(),
        errors: [],
        referenced: await awu(elements).flatMap(getElementReferenced).toArray(),
      },
      buffer: fileData,
    }
    return parsed
  }

  const setNaclFiles = async (
    ...naclFiles: NaclFile[]
  ): Promise<void> => {
    const [emptyNaclFiles, nonEmptyNaclFiles] = _.partition(
      naclFiles,
      naclFile => _.isEmpty(naclFile.buffer.trim())
    )
    await awu(nonEmptyNaclFiles).forEach(naclFile => naclFilesStore.set(naclFile))
    await awu(emptyNaclFiles).forEach(naclFile => naclFilesStore.delete(naclFile.filename))
  }

  const updateNaclFiles = async (changes: DetailedChange[]): Promise<Change[]> => {
    const getNaclFileData = async (filename: string): Promise<string> => {
      const naclFile = await naclFilesStore.get(filename)
      return naclFile ? naclFile.buffer : ''
    }

    // This method was written with the assumption that each static file is pointed by no more
    // then one value in the nacls. A ticket was open to fix that (SALTO-954)

    const removeDanglingStaticFiles = async (fileChanges: DetailedChange[]): Promise<void> => {
      await awu(fileChanges).filter(change => change.action === 'remove')
        .map(getChangeElement)
        .map(getNestedStaticFiles)
        .flat()
        .forEach(file => staticFilesSource.delete(file))
    }
    const naclFiles = _.uniq(
      await awu(changes).map(change => change.id)
        .flatMap(elemID => getElementNaclFiles(elemID.createTopLevelParentID().parent))
        .toArray()
    )
    const { parsedNaclFiles } = await getState()
    const changedFileToSourceMap: Record<string, SourceMap> = Object.fromEntries(
      (await withLimitedConcurrency(naclFiles
        .map(naclFile => async () => {
          const parsedNaclFile = await parsedNaclFiles.get(naclFile)
          return values.isDefined(parsedNaclFile)
            ? [
              parsedNaclFile.filename,
              await getSourceMap(parsedNaclFile.filename),
            ] : undefined
        }),
      CACHE_READ_CONCURRENCY)).filter(values.isDefined)
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
        // Group changes file, we use lower case in order to support case insensitive file systems
        .groupBy(change => change.location.filename.toLowerCase())
        .entries()
        .map(([_lowerCaseFilename, fileChanges]) => async ():
          Promise<ParsedNaclFile & NaclFile | undefined> => {
          // Changes might have a different cased filename, we just take the first variation
          const [filename] = fileChanges.map(change => change.location.filename).sort()
          try {
            const naclFileData = await getNaclFileData(filename)
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
                await parseNaclFile({ filename, buffer }, functions),
              )
            if ((parsed.data.errors ?? []).length > 0) {
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
    )).filter(values.isDefined)

    if (updatedNaclFiles.length > 0) {
      log.debug('going to update %d NaCl files', updatedNaclFiles.length)
      // The map is to avoid saving unnecessary fields in the nacl files
      await setNaclFiles(
        ...updatedNaclFiles.map(file => _.pick(file, ['buffer', 'filename', 'timestamp']))
      )
      const res = await buildNaclFilesStateInner(updatedNaclFiles)
      state = Promise.resolve(res.state)
      return res.changes
    }
    return []
  }

  return {
    list: async (): Promise<AsyncIterable<ElemID>> =>
      awu(Object.keys((await getState()).elementsIndex)).map(name => ElemID.fromFullName(name)),

    has: async (id: ElemID): Promise<boolean> => (await getState()).mergedElements.has(id),
    delete: async (id: ElemID): Promise<void> => (await getState()).mergedElements.delete(id),
    set: async (element: Element): Promise<void> => (await getState()).mergedElements.set(element),
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
      await cache.flush()
      await staticFilesSource.flush()
      const currentState = await getState()
      await currentState.elementsIndex.flush()
      await currentState.mergeErrors.flush()
      await currentState.mergedElements.flush()
      await currentState.referencedIndex.flush()
    },

    getErrors: async (): Promise<Errors> => {
      const currentState = await getState()
      return new Errors({
        parse: await currentState.parsedNaclFiles.getAllErrors(),
        merge: [...await awu(currentState.mergeErrors.values()).flat().toArray()],
        validation: [],
      })
    },

    listNaclFiles: async (): Promise<string[]> => Object.keys((await getState()).parsedNaclFiles),

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

    removeNaclFiles: async (...names: string[]) => {
      await awu(names).forEach(name => naclFilesStore.delete(name))
      const res = await buildNaclFilesStateInner(
        await parseNaclFiles(names.map(filename => ({ filename, buffer: '' })), cache, functions),
      )
      state = Promise.resolve(res.state)
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
        await cache.clear()
      }
      state = undefined
    },

    rename: async (name: string) => {
      await naclFilesStore.rename(name)
      await staticFilesSource.rename(name)
      await cache.rename(name)
    },

    clone: () => buildNaclFilesSource(
      sourceName,
      naclFilesStore.clone(),
      cache.clone(),
      staticFilesSource.clone(),
      remoteMapCreator,
      state,
    ),
    updateNaclFiles,
    setNaclFiles: async (...naclFiles) => {
      await setNaclFiles(...naclFiles)
      const res = await buildNaclFilesStateInner(await parseNaclFiles(naclFiles, cache, functions))
      state = Promise.resolve(res.state)
      return res.changes
    },
    getSourceMap,
    getElementNaclFiles,
    getElementReferencedFiles,
    isEmpty: () => naclFilesStore.isEmpty(),
    getElementsSource: async () => (await getState()).mergedElements,
    load: async () => {
      const res = await buildNaclFilesStateInner()
      state = Promise.resolve(res.state)
      return res.changes
    },
  }
}

export const naclFilesSource = async (
  sourceName: string,
  naclFilesStore: DirectoryStore<string>,
  cache: ParsedNaclFileCache,
  staticFilesSource: StaticFilesSource,
  remoteMapCreator: RemoteMapCreator,
  parsedFiles?: ParsedNaclFile[],
): Promise<NaclFilesSource> => {
  const state = (parsedFiles !== undefined)
    ? (await buildNaclFilesState({
      newNaclFiles: parsedFiles,
      currentState: await createNaclFilesState(
        remoteMapCreator,
        staticFilesSource,
        sourceName,
        cache
      ),
    })).state
    : undefined
  return buildNaclFilesSource(
    sourceName,
    naclFilesStore,
    cache,
    staticFilesSource,
    remoteMapCreator,
    state !== undefined ? Promise.resolve(state) : undefined,
  )
}
