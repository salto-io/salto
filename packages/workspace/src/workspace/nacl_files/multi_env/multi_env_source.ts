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
import path from 'path'
import wu from 'wu'

import { Element, ElemID, getChangeElement, Value,
  DetailedChange, Change, ChangeDataType, StaticFile } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { promises, collections, values } from '@salto-io/lowerdash'
import { applyInstanceDefaults } from '@salto-io/adapter-utils'
import { RemoteMap, RemoteMapCreator, mapRemoteMapResult } from '../../remote_map'
import { ElementSelector, selectElementIdsByTraversal } from '../../element_selector'
import { ValidationError } from '../../../validator'
import { ParseError, SourceRange, SourceMap } from '../../../parser'
import { mergeElements, MergeError } from '../../../merger'
import { routeChanges, RoutedChanges, routePromote, routeDemote, routeCopyTo } from './routers'
import { NaclFilesSource, NaclFile, RoutingMode, SourceLoadParams } from '../nacl_files_source'
import { ParsedNaclFile } from '../parsed_nacl_file'
import { createMergeManager, ElementMergeManager, ChangeSet, MergedRecoveryMode, REBUILD_ON_RECOVERY } from '../elements_cache'
import { Errors } from '../../errors'
import { RemoteElementSource, ElementsSource } from '../../elements_source'
import { serialize, deserializeSingleElement, deserializeMergeErrors } from '../../../serializer/elements'

const log = logger(module)
const { awu } = collections.asynciterable
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>
const { series } = promises.array
const { resolveValues, mapValuesAsync } = promises.object

export const ENVS_PREFIX = 'envs'
const COMMON_ENV_PREFIX = 'COMMON_'

export const getSourceNameForFilename = (relativeFilename: string, envs: string[], common: string):
string => {
  const isContained = (relPath: string, basePath: string): boolean => {
    const baseDirParts = basePath.split(path.sep)
    const relPathParts = relPath.split(path.sep)
    return _.isEqual(baseDirParts, relPathParts.slice(0, baseDirParts.length))
  }

  return envs.filter(srcPrefix => srcPrefix !== common)
    .find(srcPrefix =>
      isContained(relativeFilename, path.join(ENVS_PREFIX, srcPrefix))) ?? common
}

export class UnknownEnvironmentError extends Error {
  constructor(envName: string) {
    super(`Unknown environment ${envName}`)
  }
}

export class UnsupportedNewEnvChangeError extends Error {
  constructor(change: DetailedChange) {
    const changeElemID = getChangeElement(change).elemID.getFullName()
    const message = 'Adding a new environment only support add changes.'
      + `Received change of type ${change.action} for ${changeElemID}`
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

export type FromSource = 'env' | 'common' | 'both'

export type MultiEnvSource = Omit<NaclFilesSource<EnvsChanges>
  , 'getAll' | 'getElementsSource'> & {
  getAll: (env?: string) => Promise<AsyncIterable<Element>>
  promote: (ids: ElemID[]) => Promise<EnvsChanges>
  getElementIdsBySelectors: (
    selectors: ElementSelector[],
    fromSoruce?: FromSource,
    compact?: boolean,
  ) => Promise<AsyncIterable<ElemID>>
  demote: (ids: ElemID[]) => Promise<EnvsChanges>
  demoteAll: () => Promise<EnvsChanges>
  copyTo: (ids: ElemID[], targetEnvs?: string[]) => Promise<EnvsChanges>
  getElementsSource: (env?: string) => Promise<ElementsSource>
  getSearchableNamesOfEnv: (env?: string) => Promise<string[]>
  setCurrentEnv: (env: string) => void
}

const buildMultiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  initPrimarySourceName: string,
  commonSourceName: string,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
  initState?: MultiEnvState,
  // The following is a workaound for SALTO-1428 - remove when fixed
  mergedRecoveryMode: MergedRecoveryMode = REBUILD_ON_RECOVERY
): MultiEnvSource => {
  let primarySourceName = initPrimarySourceName
  const primarySource = (): NaclFilesSource => sources[primarySourceName]
  const commonSource = (): NaclFilesSource => sources[commonSourceName]
  const secondarySources = (): Record<string, NaclFilesSource> => (
    _.omit(sources, [primarySourceName, commonSourceName])
  )

  const getRemoteMapNamespace = (
    namespace: string, env?: string
  ): string => (env === undefined ? `multi_env-${namespace}`
    : `multi_env-${env || primarySourceName}-${namespace}`)

  const getActiveSources = (env?: string): Record<string, NaclFilesSource> => ({
    [primarySourceName]: env === undefined ? sources[primarySourceName] : sources[env],
    [commonSourceName]: sources[commonSourceName],
  })

  const getStaticFile = async (
    filePath: string,
    encoding: BufferEncoding,
  ): Promise<StaticFile | undefined> => {
    const sourcesFiles = (await Promise.all(Object.values(getActiveSources())
      .map(src => src.getStaticFile(filePath, encoding))))
      .filter(values.isDefined)
    if (sourcesFiles.length > 1
      && !_.every(sourcesFiles, sf => sf.hash === sourcesFiles[0].hash)) {
      log.warn(`Found different hashes for static file ${filePath}`)
    }
    return sourcesFiles[0]
  }

  const buildStateForSingleEnv = async (
    envName: string,
  ): Promise<SingleState> => {
    const elements = new RemoteElementSource(await remoteMapCreator<Element>({
      namespace: getRemoteMapNamespace('merged', envName),
      serialize: element => serialize([element], 'keepRef'),
      deserialize: s => deserializeSingleElement(
        s,
        async staticFile => await getStaticFile(
          staticFile.filepath,
          staticFile.encoding,
        ) ?? staticFile
      ),
      persistent,
    }))
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
  const buildMultiEnvState = async ({ envChanges = {} }: { envChanges?: EnvsChanges }):
  Promise<{ state: MultiEnvState; changes: EnvsChanges }> => {
    const states: Record<string, SingleState> = Object.fromEntries(
      (await awu(Object.keys(sources))
        .filter(name => name !== commonSourceName)
        .map(async name => [name, state?.states[name]
          ?? (await buildStateForSingleEnv(name))])
        .toArray())
    )
    let mergeManager = state?.mergeManager
    if (!mergeManager) {
      mergeManager = await createMergeManager(Object.values(states)
        .flatMap(envState => [envState.elements, envState.mergeErrors]),
      _.mapKeys(sources, (_source, envName) => (envName === commonSourceName
        ? COMMON_ENV_PREFIX + commonSourceName : envName)),
      remoteMapCreator,
      getRemoteMapNamespace('multi_env_mergeManager'),
      persistent,
      mergedRecoveryMode)
      await mergeManager.init()
    }
    const current = {
      states,
      mergeManager,
    }
    const changesInCommon = (envChanges[commonSourceName]
      ?.changes ?? []).length > 0
    const relevantEnvs = Object.keys(sources)
      .filter(name =>
        (name !== commonSourceName)
        && (changesInCommon || (envChanges[name]?.changes ?? []).length > 0))
    const getEnvMergedChanges = async (
      envName: string
    ): Promise<ChangeSet<Change<ChangeDataType>>> => {
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
            merged: mapRemoteMapResult(plainResult.merged,
              async element => applyInstanceDefaults(
                element,
                { get: async id => (await plainResult.merged.get(id.getFullName()))
                    ?? envState.elements.get(id),
                getAll: async () => awu(plainResult.merged.values())
                  .concat(await envState.elements.getAll()),
                has: async id => (await plainResult.merged.has(id.getFullName()))
                    || envState.elements.has(id),
                list: async () => awu(plainResult.merged.values())
                  .map(e => e.elemID).concat(await envState.elements.list()) }
              )),
          }
        },
      })
      return changeResult
    }
    const changes = Object.fromEntries(
      await awu(relevantEnvs)
        .map(async envName => [envName, await getEnvMergedChanges(envName)])
        .toArray()
    )
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

  const getSourceFromEnvName = (envName: string): NaclFilesSource =>
    sources[envName] ?? commonSource()

  const getRelativePath = (fullName: string, envName?: string): string => {
    if (!envName) {
      return fullName
    }
    const prefix = envName !== commonSourceName ? path.join(ENVS_PREFIX, envName) : envName
    return (prefix && sources[envName] ? fullName.slice(prefix.length + 1) : fullName)
  }


  const getSourceForNaclFile = (
    fullName: string
  ): {source: NaclFilesSource; relPath: string} => {
    const prefix = getSourceNameForNaclFile(fullName)
    return { relPath: getRelativePath(fullName, prefix), source: getSourceFromEnvName(prefix) }
  }

  const buildFullPath = (envName: string, relPath: string): string => (
    envName === commonSourceName
      ? path.join(envName, relPath)
      : path.join(ENVS_PREFIX, envName, relPath)
  )

  const getNaclFile = async (filename: string): Promise<NaclFile | undefined> => {
    const { source, relPath } = getSourceForNaclFile(filename)
    const naclFile = await source.getNaclFile(relPath)
    return naclFile ? { ...naclFile, filename } : undefined
  }

  const applyRoutedChanges = async (routedChanges: RoutedChanges):
  Promise<EnvsChanges> => {
    const secondaryChanges = routedChanges.secondarySources || {}
    const primaryChanges = [...(routedChanges.primarySource ?? [])]
    return {
      ...(await resolveValues({
        [primarySourceName]: primarySource()
          .updateNaclFiles(primaryChanges),
        [commonSourceName]: commonSource()
          .updateNaclFiles(routedChanges.commonSource ?? []),
        ..._.mapValues(secondaryChanges,
          (changes, srcName) => secondarySources()[srcName].updateNaclFiles(changes)),
      })),
    }
  }

  const updateNaclFiles = async (
    changes: DetailedChange[],
    mode: RoutingMode = 'default'
  ): Promise<EnvsChanges> => {
    const routedChanges = await routeChanges(
      changes,
      primarySource(),
      commonSource(),
      secondarySources(),
      mode
    )
    const elementChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges: elementChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const getElementsSource = async (env?: string): Promise<ElementsSource> => (
    (await getState()).states[env ?? primarySourceName].elements
  )

  const determineSource = async (fromSource: FromSource): Promise<ElementsSource> => {
    switch (fromSource) {
      case 'env': {
        return primarySource()
      }
      case 'common': {
        return commonSource()
      }
      default: {
        return getElementsSource()
      }
    }
  }

  const getElementIdsBySelectors = async (
    selectors: ElementSelector[],
    fromSource: FromSource = 'env',
    compact = false,
  ): Promise<AsyncIterable<ElemID>> => {
    const relevantSource: ElementsSource = await determineSource(fromSource)
    return selectElementIdsByTraversal(
      selectors,
      relevantSource,
      compact,
    )
  }

  const promote = async (ids: ElemID[]): Promise<EnvsChanges> => {
    const routedChanges = await routePromote(
      ids,
      primarySource(),
      commonSource(),
      secondarySources(),
    )
    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const demote = async (ids: ElemID[]): Promise<EnvsChanges> => {
    const routedChanges = await routeDemote(
      ids,
      primarySource(),
      commonSource(),
      secondarySources(),
    )
    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const copyTo = async (ids: ElemID[], targetEnvs: string[] = []): Promise<EnvsChanges> => {
    const targetSources = _.isEmpty(targetEnvs)
      ? secondarySources()
      : _.pick(secondarySources(), targetEnvs)
    const routedChanges = await routeCopyTo(
      ids,
      primarySource(),
      targetSources,
    )
    const envChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ envChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const demoteAll = async (): Promise<EnvsChanges> => {
    const commonFileSource = commonSource()
    const routedChanges = await routeDemote(
      await awu(await commonFileSource.list()).toArray(),
      primarySource(),
      commonFileSource,
      secondarySources(),
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
    await awu([
      primarySource(),
      commonSource(),
      ...Object.values(secondarySources()),
    ]).forEach(async src => src.flush())
    await (await getState()).mergeManager.flush()
  }

  const isEmpty = async (env?: string): Promise<boolean> => (
    (await Promise.all(
      _.values(getActiveSources(env)).filter(s => s !== undefined).map(s => s.isEmpty())
    )).every(e => e)
  )

  const load = async ({ ignoreFileChanges = false }: SourceLoadParams): Promise<EnvsChanges> => {
    const changes = await mapValuesAsync(sources, src => src.load({ ignoreFileChanges }))
    const buildResults = await buildMultiEnvState({ envChanges: changes })
    state = buildResults.state
    return buildResults.changes
  }

  const getErrors = async (): Promise<Errors> => {
    const rebaseSrcErrorsPaths = (prefix: string, errors: Errors): Errors => new Errors({
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
        _.entries(getActiveSources()).map(async ([prefix, source]) => rebaseSrcErrorsPaths(
          prefix,
          await source.getErrors(),
        ))
      ),
      awu(currentState.states[primarySourceName].mergeErrors.values()).flat().toArray(),
    ])
    return new Errors(_.reduce(srcErrors, (acc, errors) => ({
      ...acc,
      parse: [...acc.parse, ...errors.parse],
      merge: [...acc.merge, ...errors.merge],
    }),
    {
      merge: mergeErrors,
      parse: [] as ParseError[],
      validation: [] as ValidationError[],
    }))
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
    list: async (): Promise<AsyncIterable<ElemID>> =>
      (await getState()).states[primarySourceName].elements.list(),
    isEmpty,
    get: async (id: ElemID): Promise<Element | Value> => (
      (await getState()).states[primarySourceName].elements.get(id)
    ),
    has: async (id: ElemID): Promise<boolean> => (
      (await getState()).states[primarySourceName].elements.has(id)
    ),
    delete: async (id: ElemID): Promise<void> => (
      (await getState()).states[primarySourceName].elements.delete(id)
    ),
    deleteAll: async (ids: ThenableIterable<ElemID>): Promise<void> => (
      (await getState()).states[primarySourceName].elements.deleteAll(ids)
    ),
    set: async (elem: Element): Promise<void> => (
      (await getState()).states[primarySourceName].elements.set(elem)
    ),
    setAll: async (elements: ThenableIterable<Element>): Promise<void> => (
      (await getState()).states[primarySourceName].elements.setAll(elements)
    ),
    getAll: async (env?: string): Promise<AsyncIterable<Element>> =>
      (await getState()).states[env ?? primarySourceName].elements.getAll(),
    listNaclFiles: async (): Promise<string[]> => (
      awu(Object.entries(getActiveSources()))
        .flatMap(async ([prefix, source]) => (
          (await source.listNaclFiles()).map(p => buildFullPath(prefix, p)))).toArray()
    ),
    getTotalSize: async (): Promise<number> => (
      _.sum(await Promise.all(Object.values(sources).map(s => s.getTotalSize())))
    ),
    setNaclFiles: async (...naclFiles: NaclFile[]): Promise<EnvsChanges> => {
      const envNameToNaclFiles = _.groupBy(
        naclFiles, naclFile => getSourceNameForNaclFile(naclFile.filename)
      )
      const envNameToChanges = await mapValuesAsync(envNameToNaclFiles,
        async (envNaclFiles, envName) => {
          const naclFilesWithRelativePath = envNaclFiles.map(naclFile =>
            ({
              ...naclFile,
              filename: getRelativePath(naclFile.filename, envName),
            }))
          return getSourceFromEnvName(envName)
            .setNaclFiles(...naclFilesWithRelativePath)
        })
      const buildRes = await buildMultiEnvState({ envChanges: envNameToChanges })
      if (Object.keys(envNameToChanges).includes(primarySourceName)) {
        state = buildRes.state
      }
      return buildRes.changes
    },
    removeNaclFiles: async (...names: string[]): Promise<EnvsChanges> => {
      const envNameToFilesToRemove = _.groupBy(names, getSourceNameForNaclFile)
      const envNameToChanges = await mapValuesAsync(envNameToFilesToRemove, (files, envName) =>
        getSourceFromEnvName(envName)
          .removeNaclFiles(...files.map(fileName => getRelativePath(fileName, envName))))
      const buildRes = await buildMultiEnvState({ envChanges: envNameToChanges })
      state = buildRes.state
      return buildRes.changes
    },
    getSourceMap: async (filename: string): Promise<SourceMap> => {
      const { source, relPath } = getSourceForNaclFile(filename)
      const sourceMap = await source.getSourceMap(relPath)
      return new SourceMap(wu(sourceMap.entries())
        .map(([key, ranges]) => [
          key,
          ranges.map(r => ({ ...r, filename })),
        ] as [string, SourceRange[]]))
    },
    getSourceRanges: async (elemID: ElemID): Promise<SourceRange[]> => (
      awu(Object.entries(getActiveSources()))
        .flatMap(async ([prefix, source]) => (
          await source.getSourceRanges(elemID)).map(sourceRange => ({
          ...sourceRange,
          filename: buildFullPath(prefix, sourceRange.filename),
        }))).toArray()
    ),
    getErrors,
    getParsedNaclFile: async (filename: string): Promise<ParsedNaclFile | undefined> => {
      const { source, relPath } = getSourceForNaclFile(filename)
      return source.getParsedNaclFile(relPath)
    },
    getElementNaclFiles: async (id: ElemID): Promise<string[]> =>
      _.flatten(await Promise.all(Object.entries(getActiveSources())
        .map(async ([prefix, source]) => (
          await source.getElementNaclFiles(id)).map(p => buildFullPath(prefix, p))))),
    getElementReferencedFiles: async (id: ElemID): Promise<string[]> =>
      _.flatten(await Promise.all(Object.entries(getActiveSources())
        .map(async ([prefix, source]) => (
          await source.getElementReferencedFiles(id)).map(p => buildFullPath(prefix, p))))),
    clear: async (args = { nacl: true, staticResources: true, cache: true }) => {
      // We use loop here since we don't want to perform too much delete operation concurrently
      await awu([primarySource(), commonSource(), ...Object.values(secondarySources())])
        .forEach(async s => {
          await s.load({})
          await s.clear(args)
        })
      const currentState = await getState()
      await currentState.mergeManager.clear()
      state = undefined
    },
    rename: async (name: string): Promise<void> => {
      await series([primarySource(), commonSource(), ...Object.values(secondarySources())]
        .map(f => () => f.rename(name)))
    },
    clone: () => buildMultiEnvSource(
      _.mapValues(sources, source => source.clone()),
      primarySourceName,
      commonSourceName,
      remoteMapCreator,
      persistent,
      state
    ),
    load,
    setCurrentEnv: env => {
      primarySourceName = env
    },
    getSearchableNames: async (): Promise<string[]> => {
      const [primarySearchableNames, commonSearchableNames] = await Promise.all(
        [primarySource().getSearchableNames(), commonSource().getSearchableNames()]
      )
      return _.uniq([...primarySearchableNames, ...commonSearchableNames])
    },
    getSearchableNamesOfEnv: async (env?: string): Promise<string[]> => {
      const naclSource = env === undefined ? primarySource() : sources[env]
      return naclSource === undefined ? [] : naclSource.getSearchableNames()
    },
    getStaticFile,
  }
}

export const multiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  primarySourceName: string,
  commonSourceName: string,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
  // The following is a workaound for SALTO-1428 - remove when fixed
  mergedRecoveryMode: MergedRecoveryMode = 'rebuild'
): MultiEnvSource => buildMultiEnvSource(
  sources,
  primarySourceName,
  commonSourceName,
  remoteMapCreator,
  persistent,
  // The following 2 arguments are a workaound for SALTO-1428 - remove when fixed
  undefined,
  mergedRecoveryMode
)
