/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import path from 'path'
import wu from 'wu'

import {
  Element,
  ElemID,
  getChangeData,
  DetailedChange,
  Change,
  ChangeDataType,
  StaticFile,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { promises, collections, values, objects } from '@salto-io/lowerdash'
import { applyInstanceDefaults } from '@salto-io/adapter-utils'
import { parser } from '@salto-io/parser'
import { RemoteMap, RemoteMapCreator, mapRemoteMapResult } from '../../remote_map'
import { ElementSelector, selectElementIdsByTraversal } from '../../element_selector'
import { ValidationError } from '../../../validator'
import { mergeElements, MergeError } from '../../../merger'
import { routeChanges, RoutedChanges, routePromote, routeDemote, routeCopyTo, routeRemoveFrom } from './routers'
import { NaclFilesSource, NaclFile, RoutingMode, SourceLoadParams } from '../nacl_files_source'
import { ParsedNaclFile } from '../parsed_nacl_file'
import {
  createMergeManager,
  ElementMergeManager,
  ChangeSet,
  MergedRecoveryMode,
  REBUILD_ON_RECOVERY,
} from '../elements_cache'
import { Errors } from '../../errors'
import { RemoteElementSource, ElementsSource } from '../../elements_source'
import { serialize, deserializeSingleElement, deserializeMergeErrors } from '../../../serializer/elements'
import { MissingStaticFile } from '../../static_files'

const log = logger(module)
const { awu } = collections.asynciterable
const { series } = promises.array
const { resolveValues, mapValuesAsync } = promises.object
const { concatObjects } = objects

export const ENVS_PREFIX = 'envs'
const COMMON_ENV_PREFIX = 'COMMON_'

export const getSourceNameForFilename = (relativeFilename: string, envs: string[], common: string): string => {
  const isContained = (relPath: string, basePath: string): boolean => {
    const baseDirParts = basePath.split(path.sep)
    const relPathParts = relPath.split(path.sep)
    return _.isEqual(baseDirParts, relPathParts.slice(0, baseDirParts.length))
  }

  return (
    envs
      .filter(srcPrefix => srcPrefix !== common)
      .find(srcPrefix => isContained(relativeFilename, path.join(ENVS_PREFIX, srcPrefix))) ?? common
  )
}

export class UnknownEnvironmentError extends Error {
  constructor(envName: string) {
    super(`Unknown environment ${envName}`)
  }
}

export class UnsupportedNewEnvChangeError extends Error {
  constructor(change: DetailedChange) {
    const changeElemID = getChangeData(change).elemID.getFullName()
    const message =
      'Adding a new environment only support add changes.' +
      `Received change of type ${change.action} for ${changeElemID}`
    super(message)
  }
}

type SingleState = {
  elements: ElementsSource
  mergeErrors: RemoteMap<MergeError[]>
}
type MultiEnvState = {
  states: Record<string, SingleState>
  mergeManager: ElementMergeManager
}

export type EnvsChanges = Record<string, ChangeSet<Change>>

export type FromSource = 'env' | 'common' | 'all'

export type MultiEnvSource = {
  updateNaclFiles: (env: string, changes: DetailedChange[], mode?: RoutingMode) => Promise<EnvsChanges>
  listNaclFiles: (env: string) => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  getElementNaclFiles: (env: string, id: ElemID) => Promise<string[]>
  getElementReferencedFiles: (env: string, id: ElemID) => Promise<string[]>
  getElementFileNames: (env: string) => Promise<Map<string, string[]>>
  setNaclFiles: (naclFiles: NaclFile[]) => Promise<EnvsChanges>
  removeNaclFiles: (names: string[]) => Promise<EnvsChanges>
  getSourceMap: (filename: string) => Promise<parser.SourceMap>
  getSourceRanges: (env: string, elemID: ElemID) => Promise<parser.SourceRange[]>
  getErrors: (env: string) => Promise<Errors>
  getParsedNaclFile: (filename: string) => Promise<ParsedNaclFile | undefined>
  clone: () => MultiEnvSource
  isEmpty: (env: string) => Promise<boolean>
  clear(args?: { nacl?: boolean; staticResources?: boolean; cache?: boolean }): Promise<void>
  load: (args: SourceLoadParams) => Promise<EnvsChanges>
  getSearchableNames(env: string): Promise<string[]>
  getStaticFile: (args: {
    filePath: string
    encoding: BufferEncoding
    env: string
    isTemplate?: boolean
  }) => Promise<StaticFile | undefined>
  getAll: (env: string) => Promise<AsyncIterable<Element>>
  promote: (env: string, idsToMove: ElemID[], idsToRemove?: Record<string, ElemID[]>) => Promise<EnvsChanges>
  getElementIdsBySelectors: (
    env: string,
    selectors: ElementSelector[],
    referencedByIndex: RemoteMap<ElemID[]>,
    fromSource?: FromSource,
    compact?: boolean,
  ) => Promise<AsyncIterable<ElemID>>
  demote: (ids: ElemID[]) => Promise<EnvsChanges>
  demoteAll: () => Promise<EnvsChanges>
  copyTo: (env: string, ids: ElemID[], targetEnvs?: string[]) => Promise<EnvsChanges>
  sync: (
    env: string,
    idsToCopy: ElemID[],
    idsToRemove: Record<string, ElemID[]>,
    targetEnvs: string[],
  ) => Promise<EnvsChanges>
  getElementsSource: (env: string) => Promise<ElementsSource>
  getSearchableNamesOfEnv: (env: string) => Promise<string[]>
  flush: () => Promise<void>
  rename: (name: string) => Promise<void>
  getFileEnvs: (filePath: string) => { envName: string; isNacl?: boolean }[]
}

const buildMultiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  commonSourceName: string,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
  initState?: MultiEnvState,
  // The following is a workaound for SALTO-1428 - remove when fixed
  mergedRecoveryMode: MergedRecoveryMode = REBUILD_ON_RECOVERY,
): MultiEnvSource => {
  const commonSource = (): NaclFilesSource => sources[commonSourceName]
  const envSources = (): Record<string, NaclFilesSource> => _.omit(sources, [commonSourceName])

  const getRemoteMapNamespace = (namespace: string, env?: string): string =>
    env === undefined ? `multi_env-${namespace}` : `multi_env-${env}-${namespace}`

  const getActiveSources = (env: string): Record<string, NaclFilesSource> => _.pick(sources, [commonSourceName, env])

  const getStaticFile = async (
    args: string | { filePath: string; encoding: BufferEncoding; env: string; isTemplate?: boolean },
    encoding?: BufferEncoding,
    envName?: string,
  ): Promise<StaticFile> => {
    let filePath: string
    let fileEncoding: BufferEncoding
    let environmentName: string

    // Check if args is a string or an object and assign values accordingly
    if (_.isString(args)) {
      if (encoding === undefined || envName === undefined) {
        throw new Error("When 'args' is a string, 'encoding' and 'envName' must be provided")
      }
      filePath = args
      fileEncoding = encoding
      environmentName = envName
    } else {
      filePath = args.filePath
      fileEncoding = args.encoding
      environmentName = args.env
    }
    const sourcesFiles = (
      await Promise.all(
        Object.values(getActiveSources(environmentName)).map(src =>
          src.getStaticFile({
            filePath,
            encoding: fileEncoding,
            isTemplate: _.isObject(args) ? args.isTemplate : undefined,
          }),
        ),
      )
    ).filter(values.isDefined)
    if (sourcesFiles.length > 1 && !_.every(sourcesFiles, sf => sf.hash === sourcesFiles[0].hash)) {
      log.warn(`Found different hashes for static file ${filePath}`)
    }
    return sourcesFiles[0] ?? new MissingStaticFile(filePath)
  }

  const buildStateForSingleEnv = async (envName: string): Promise<SingleState> => {
    const elements = new RemoteElementSource(
      await remoteMapCreator<Element>({
        namespace: getRemoteMapNamespace('merged', envName),
        serialize: element => serialize([element], 'keepRef'),
        deserialize: s =>
          deserializeSingleElement(
            s,
            async staticFile =>
              (await getStaticFile({
                filePath: staticFile.filepath,
                encoding: staticFile.encoding,
                env: envName,
                isTemplate: staticFile.isTemplate,
              })) ?? staticFile,
          ),
        persistent,
      }),
    )
    return {
      elements,
      mergeErrors: await remoteMapCreator<MergeError[]>({
        namespace: getRemoteMapNamespace('errors', envName),
        serialize: errors => serialize(errors, 'keepRef'),
        deserialize: async data => deserializeMergeErrors(data),
        persistent,
      }),
    }
  }

  let state = initState
  const buildMultiEnvState = async ({
    envChanges = {},
    ignoreFileChanges = false,
  }: {
    envChanges?: EnvsChanges
    ignoreFileChanges?: boolean
  }): Promise<{ state: MultiEnvState; changes: EnvsChanges }> => {
    const states = await mapValuesAsync(
      envSources(),
      async (_source, envName) => state?.states[envName] ?? buildStateForSingleEnv(envName),
    )
    let mergeManager = state?.mergeManager
    if (!mergeManager) {
      mergeManager = await createMergeManager(
        Object.values(states).flatMap(envState => [envState.elements, envState.mergeErrors]),
        _.mapKeys(sources, (_source, envName) =>
          envName === commonSourceName ? COMMON_ENV_PREFIX + commonSourceName : envName,
        ),
        remoteMapCreator,
        getRemoteMapNamespace('multi_env_mergeManager'),
        persistent,
        mergedRecoveryMode,
      )
    }
    const current = {
      states,
      mergeManager,
    }
    const getEnvMergedChanges = async (envName: string): Promise<ChangeSet<Change<ChangeDataType>>> => {
      const envState = current.states[envName]
      const changeResult = await current.mergeManager.mergeComponents({
        src1Changes: envChanges[envName],
        src2Changes: envChanges[commonSourceName],
        src1Prefix: envName,
        src2Prefix: COMMON_ENV_PREFIX + commonSourceName,
        currentElements: envState.elements,
        currentErrors: envState.mergeErrors,
        mergeFunc: async elements => {
          const plainResult = await mergeElements(elements)
          return {
            errors: plainResult.errors,
            merged: mapRemoteMapResult(plainResult.merged, async element =>
              applyInstanceDefaults(element, {
                get: async id => (await plainResult.merged.get(id.getFullName())) ?? envState.elements.get(id),
                getAll: async () => awu(plainResult.merged.values()).concat(await envState.elements.getAll()),
                has: async id => (await plainResult.merged.has(id.getFullName())) || envState.elements.has(id),
                list: async () =>
                  awu(plainResult.merged.values())
                    .map(e => e.elemID)
                    .concat(await envState.elements.list()),
              }),
            ),
          }
        },
      })
      return changeResult
    }
    const changes = ignoreFileChanges
      ? {}
      : await mapValuesAsync(envSources(), (_source, envName) => getEnvMergedChanges(envName))
    return {
      state: current,
      changes,
    }
  }

  const getState = async (): Promise<MultiEnvState> => {
    if (_.isUndefined(state)) {
      state = (await buildMultiEnvState({})).state
    }
    return state
  }

  const getSourceNameForNaclFile = (fullName: string): string =>
    getSourceNameForFilename(fullName, Object.keys(sources), commonSourceName)

  const getSourceFromEnvName = (envName: string): NaclFilesSource => sources[envName] ?? commonSource()

  const getRelativePath = (fullName: string, envName?: string): string => {
    if (!envName) {
      return fullName
    }
    const prefix = envName !== commonSourceName ? path.join(ENVS_PREFIX, envName) : envName
    return prefix && sources[envName] ? fullName.slice(prefix.length + 1) : fullName
  }

  const getSourceForNaclFile = (fullName: string): { source: NaclFilesSource; relPath: string; prefix: string } => {
    const prefix = getSourceNameForNaclFile(fullName)
    return {
      relPath: getRelativePath(fullName, prefix),
      source: getSourceFromEnvName(prefix),
      prefix,
    }
  }

  const buildFullPath = (envName: string, relPath: string): string =>
    envName === commonSourceName ? path.join(envName, relPath) : path.join(ENVS_PREFIX, envName, relPath)

  const getNaclFile = async (filename: string): Promise<NaclFile | undefined> => {
    const { source, relPath } = getSourceForNaclFile(filename)
    const naclFile = await source.getNaclFile(relPath)
    return naclFile ? { ...naclFile, filename } : undefined
  }

  const applyRoutedChanges = async (routedChanges: RoutedChanges): Promise<EnvsChanges> => ({
    ...(await resolveValues({
      [commonSourceName]: commonSource().updateNaclFiles(routedChanges.commonSource ?? []),
      ..._.mapValues(routedChanges.envSources, (changes, srcName) => envSources()[srcName].updateNaclFiles(changes)),
    })),
  })

  const updateNaclFiles = async (
    env: string,
    changes: DetailedChange[],
    mode: RoutingMode = 'default',
  ): Promise<EnvsChanges> => {
    const routedChanges = await routeChanges(changes, env, commonSource(), envSources(), mode)
    const elementChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges: elementChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const getElementsSource = async (env: string): Promise<ElementsSource> => (await getState()).states[env].elements

  const determineSource = async (env: string, source: FromSource): Promise<ElementsSource> => {
    switch (source) {
      case 'env': {
        return envSources()[env]
      }
      case 'common': {
        return commonSource()
      }
      default: {
        return getElementsSource(env)
      }
    }
  }

  const getElementIdsBySelectors = async (
    env: string,
    selectors: ElementSelector[],
    referenceSourcesIndex: RemoteMap<ElemID[]>,
    fromSource: FromSource = 'env',
    compact = false,
  ): Promise<AsyncIterable<ElemID>> => {
    const relevantSource: ElementsSource = await determineSource(env, fromSource)
    return selectElementIdsByTraversal({
      selectors,
      source: relevantSource,
      referenceSourcesIndex,
      compact,
    })
  }

  const mergeRoutedChanges = (routedChanges: RoutedChanges[]): RoutedChanges => ({
    commonSource: routedChanges.flatMap(change => change.commonSource).filter(values.isDefined),
    envSources: concatObjects(routedChanges.map(change => change.envSources).filter(values.isDefined)),
  })

  const promote = async (
    env: string,
    idsToMove: ElemID[],
    idsToRemove?: Record<string, ElemID[]>,
  ): Promise<EnvsChanges> => {
    const routedMoveChanges = await routePromote(idsToMove, env, commonSource(), envSources())

    const routedRemovalChanges = await Promise.all(
      Object.entries(idsToRemove ?? {}).map(([envName, ids]) => routeRemoveFrom(ids, envSources()[envName], envName)),
    )

    const routedChanges = mergeRoutedChanges([routedMoveChanges, ...routedRemovalChanges])

    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const demote = async (ids: ElemID[]): Promise<EnvsChanges> => {
    const routedChanges = await routeDemote(ids, commonSource(), envSources())
    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const getRoutedCopyChanges = (env: string, ids: ElemID[], targetEnvs: string[]): Promise<RoutedChanges> => {
    const targetSources = _.isEmpty(targetEnvs) ? _.omit(envSources(), env) : _.pick(envSources(), targetEnvs)

    return routeCopyTo(ids, envSources()[env], targetSources)
  }

  const copyTo = async (env: string, ids: ElemID[], targetEnvs: string[] = []): Promise<EnvsChanges> => {
    const routedChanges = await getRoutedCopyChanges(env, ids, targetEnvs)
    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const sync = async (
    env: string,
    idsToCopy: ElemID[],
    idsToRemove: Record<string, ElemID[]>,
    targetEnvs: string[],
  ): Promise<EnvsChanges> => {
    const routedCopyChanges = await getRoutedCopyChanges(env, idsToCopy, targetEnvs)

    const routedRemovalChanges = await Promise.all(
      Object.entries(idsToRemove).map(([envName, ids]) => routeRemoveFrom(ids, envSources()[envName], envName)),
    )

    const routedChanges = mergeRoutedChanges([routedCopyChanges, ...routedRemovalChanges])
    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const demoteAll = async (): Promise<EnvsChanges> => {
    const commonFileSource = commonSource()
    const routedChanges = await routeDemote(
      await awu(await commonFileSource.list()).toArray(),
      commonFileSource,
      envSources(),
    )
    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const flush = async (): Promise<void> => {
    if (!persistent) {
      throw new Error('can not flush a non persistent multi env source.')
    }
    await awu([commonSource(), ...Object.values(envSources())]).forEach(async src => src.flush())
    await (await getState()).mergeManager.flush()
  }

  const isEmpty = async (env: string): Promise<boolean> =>
    (
      await Promise.all(
        _.values(getActiveSources(env))
          .filter(s => s !== undefined)
          .map(s => s.isEmpty()),
      )
    ).every(e => e)

  const load = async ({ ignoreFileChanges = false }: SourceLoadParams): Promise<EnvsChanges> => {
    const changes = await mapValuesAsync(sources, src => src.load({ ignoreFileChanges }))
    const buildResults = await buildMultiEnvState({ envChanges: changes, ignoreFileChanges })
    state = buildResults.state
    return buildResults.changes
  }

  const getErrors = async (env: string): Promise<Errors> => {
    const rebaseSrcErrorsPaths = (prefix: string, errors: Errors): Errors =>
      new Errors({
        ...errors,
        parse: errors.parse.map(err => ({
          ...err,
          subject: {
            ...err.subject,
            filename: buildFullPath(prefix, err.subject.filename),
          },
          context: err.context && {
            ...err.context,
            filename: buildFullPath(prefix, err.context.filename),
          },
        })),
      })

    const currentState = await getState()
    const [srcErrors, mergeErrors] = await Promise.all([
      Promise.all(
        _.entries(getActiveSources(env)).map(async ([prefix, source]) =>
          rebaseSrcErrorsPaths(prefix, await source.getErrors()),
        ),
      ),
      awu(currentState.states[env].mergeErrors.values()).flat().toArray(),
    ])
    return new Errors(
      _.reduce(
        srcErrors,
        (acc, errors) => ({
          ...acc,
          parse: [...acc.parse, ...errors.parse],
          merge: [...acc.merge, ...errors.merge],
        }),
        {
          merge: mergeErrors,
          parse: [] as parser.ParseError[],
          validation: [] as ValidationError[],
        },
      ),
    )
  }

  const getFileEnvs = (filePath: string): { envName: string; isNacl?: boolean }[] => {
    const source = getSourceForNaclFile(filePath)
    const { included, isNacl } = source.source.isPathIncluded(source.relPath)
    if (!included) {
      return []
    }
    return source.prefix === commonSourceName
      ? Object.keys(envSources()).map(envName => ({ envName, isNacl }))
      : [{ envName: source.prefix, isNacl }]
  }

  return {
    getNaclFile,
    updateNaclFiles,
    flush,
    getElementsSource,
    getElementIdsBySelectors,
    promote,
    demote,
    demoteAll,
    copyTo,
    sync,
    isEmpty,
    getAll: async (env: string): Promise<AsyncIterable<Element>> => (await getState()).states[env].elements.getAll(),
    listNaclFiles: async (env: string): Promise<string[]> =>
      awu(Object.entries(getActiveSources(env)))
        .flatMap(async ([prefix, source]) => (await source.listNaclFiles()).map(p => buildFullPath(prefix, p)))
        .toArray(),
    getTotalSize: async (): Promise<number> =>
      _.sum(await Promise.all(Object.values(sources).map(s => s.getTotalSize()))),
    setNaclFiles: async (naclFiles: NaclFile[]): Promise<EnvsChanges> => {
      const envNameToNaclFiles = _.groupBy(naclFiles, naclFile => getSourceNameForNaclFile(naclFile.filename))
      const envNameToChanges = await mapValuesAsync(envNameToNaclFiles, async (envNaclFiles, envName) => {
        const naclFilesWithRelativePath = envNaclFiles.map(naclFile => ({
          ...naclFile,
          filename: getRelativePath(naclFile.filename, envName),
        }))
        return getSourceFromEnvName(envName).setNaclFiles(naclFilesWithRelativePath)
      })
      const buildRes = await buildMultiEnvState({ envChanges: envNameToChanges })
      state = buildRes.state
      return buildRes.changes
    },
    removeNaclFiles: async (names: string[]): Promise<EnvsChanges> => {
      const envNameToFilesToRemove = _.groupBy(names, getSourceNameForNaclFile)
      const envNameToChanges = await mapValuesAsync(envNameToFilesToRemove, (files, envName) =>
        getSourceFromEnvName(envName).removeNaclFiles(files.map(fileName => getRelativePath(fileName, envName))),
      )
      const buildRes = await buildMultiEnvState({ envChanges: envNameToChanges })
      state = buildRes.state
      return buildRes.changes
    },
    getSourceMap: async (filename: string): Promise<parser.SourceMap> => {
      const { source, relPath } = getSourceForNaclFile(filename)
      const sourceMap = await source.getSourceMap(relPath)
      return new parser.SourceMap(
        wu(sourceMap.entries()).map(
          ([key, ranges]) => [key, ranges.map(r => ({ ...r, filename }))] as [string, parser.SourceRange[]],
        ),
      )
    },
    getSourceRanges: async (env: string, elemID: ElemID): Promise<parser.SourceRange[]> =>
      awu(Object.entries(getActiveSources(env)))
        .flatMap(async ([prefix, source]) =>
          (await source.getSourceRanges(elemID)).map(sourceRange => ({
            ...sourceRange,
            filename: buildFullPath(prefix, sourceRange.filename),
          })),
        )
        .toArray(),
    getErrors,
    getParsedNaclFile: async (filename: string): Promise<ParsedNaclFile | undefined> => {
      const { source, relPath } = getSourceForNaclFile(filename)
      return source.getParsedNaclFile(relPath)
    },
    getElementNaclFiles: async (env: string, id: ElemID): Promise<string[]> =>
      _.flatten(
        await Promise.all(
          Object.entries(getActiveSources(env)).map(async ([prefix, source]) =>
            (await source.getElementNaclFiles(id)).map(p => buildFullPath(prefix, p)),
          ),
        ),
      ),
    getElementFileNames: async (env: string): Promise<Map<string, string[]>> => {
      const res = new Map<string, string[]>()
      const elementFilenamesBySource = await mapValuesAsync(getActiveSources(env), source =>
        source.getElementFileNames(),
      )
      Object.entries(elementFilenamesBySource).forEach(([envName, elementsFileNames]) => {
        elementsFileNames.forEach((fileNames, element) => {
          const fullFileNames = fileNames.map(fileName => buildFullPath(envName, fileName))
          const currentValue = res.get(element)
          res.set(element, currentValue === undefined ? fullFileNames : currentValue.concat(fullFileNames))
        })
      })
      return res
    },
    getElementReferencedFiles: async (env: string, id: ElemID): Promise<string[]> =>
      _.flatten(
        await Promise.all(
          Object.entries(getActiveSources(env)).map(async ([prefix, source]) =>
            (await source.getElementReferencedFiles(id)).map(p => buildFullPath(prefix, p)),
          ),
        ),
      ),
    clear: async (args = { nacl: true, staticResources: true, cache: true }) => {
      // We use loop here since we don't want to perform too much delete operation concurrently
      await awu(Object.values(sources)).forEach(async s => {
        await s.load({})
        await s.clear(args)
      })
      const currentState = await getState()
      await awu(Object.values(currentState.states)).forEach(async s => {
        await s.elements.clear()
        await s.mergeErrors.clear()
      })
      await currentState.mergeManager.clear()
      state = undefined
    },
    rename: async (name: string): Promise<void> => {
      await series(Object.values(sources).map(f => () => f.rename(name)))
    },
    clone: () =>
      buildMultiEnvSource(
        _.mapValues(sources, source => source.clone()),
        commonSourceName,
        remoteMapCreator,
        persistent,
        state,
      ),
    load,
    getSearchableNames: async (env: string): Promise<string[]> =>
      _.uniq(
        await awu(Object.values(getActiveSources(env)))
          .flatMap(s => s.getSearchableNames())
          .toArray(),
      ),
    getSearchableNamesOfEnv: async (env: string): Promise<string[]> => {
      const naclSource = sources[env]
      return naclSource === undefined ? [] : naclSource.getSearchableNames()
    },
    getStaticFile,
    getFileEnvs,
  }
}

export const multiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  commonSourceName: string,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
  // The following is a workaound for SALTO-1428 - remove when fixed
  mergedRecoveryMode: MergedRecoveryMode = 'rebuild',
): MultiEnvSource =>
  buildMultiEnvSource(
    sources,
    commonSourceName,
    remoteMapCreator,
    persistent,
    // The following 2 arguments are a workaound for SALTO-1428 - remove when fixed
    undefined,
    mergedRecoveryMode,
  )
