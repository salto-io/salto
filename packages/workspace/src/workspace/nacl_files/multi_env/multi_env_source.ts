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
  DetailedChange, Change } from '@salto-io/adapter-api'
import { promises, collections } from '@salto-io/lowerdash'
import { applyInstanceDefaults } from '@salto-io/adapter-utils'
import { RemoteMap, RemoteMapCreator, mapRemoteMapResult } from '../../remote_map'
import { ElementSelector, selectElementIdsByTraversal } from '../../element_selector'
import { ValidationError } from '../../../validator'
import { ParseError, SourceRange, SourceMap } from '../../../parser'
import { mergeElements, MergeError } from '../../../merger'
import { routeChanges, RoutedChanges, routePromote, routeDemote, routeCopyTo } from './routers'
import { NaclFilesSource, NaclFile, RoutingMode } from '../nacl_files_source'
import { ParsedNaclFile } from '../parsed_nacl_file'
import { buildNewMergedElementsAndErrors, getBuildMergeData } from '../elements_cache'
import { Errors } from '../../errors'
import { RemoteElementSource, ElementsSource } from '../../elements_source'
import { serialize, deserializeSingleElement, deserializeMergeErrors } from '../../../serializer/elements'

const { awu } = collections.asynciterable
const { series } = promises.array
const { resolveValues, mapValuesAsync } = promises.object

export const ENVS_PREFIX = 'envs'

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

export class UnknownEnviornmentError extends Error {
  constructor(envName: string) {
    super(`Unknown enviornment ${envName}`)
  }
}

export class UnsupportedNewEnvChangeError extends Error {
  constructor(change: DetailedChange) {
    const changeElemID = getChangeElement(change).elemID.getFullName()
    const message = 'Adding a new enviornment only support add changes.'
      + `Received change of type ${change.action} for ${changeElemID}`
    super(message)
  }
}

type MultiEnvState = {
  elements: ElementsSource
  mergeErrors: RemoteMap<MergeError[]>
}

export type EnvChanges = Record<string, Change[]>

export type MultiEnvSource = Omit<NaclFilesSource<Change[]>, 'getAll' | 'getElementsSource'> & {
  getAll: (env?: string) => Promise<AsyncIterable<Element>>
  promote: (ids: ElemID[]) => Promise<void>
  getElementIdsBySelectors: (selectors: ElementSelector[],
    commonOnly?: boolean) => Promise<AsyncIterable<ElemID>>
  demote: (ids: ElemID[]) => Promise<void>
  demoteAll: () => Promise<void>
  copyTo: (ids: ElemID[], targetEnvs?: string[]) => Promise<void>
  getElementsSource: (env?: string) => Promise<ElementsSource>
  setCurrentEnv: (env: string) => void
}

const buildMultiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  initPrimarySourceName: string,
  commonSourceName: string,
  remoteMapCreator: RemoteMapCreator,
  initState?: MultiEnvState
): MultiEnvSource => {
  let primarySourceName = initPrimarySourceName
  const primarySource = (): NaclFilesSource => sources[primarySourceName]
  const commonSource = (): NaclFilesSource => sources[commonSourceName]
  const secondarySources = (): Record<string, NaclFilesSource> => (
    _.omit(sources, [primarySourceName, commonSourceName])
  )

  const getRemoteMapNamespace = (
    namespace: string, env?: string
  ): string => `multi_env-${env || primarySourceName}-${namespace}`

  const getActiveSources = (env?: string): Record<string, NaclFilesSource> => ({
    [primarySourceName]: env === undefined ? sources[primarySourceName] : sources[env],
    [commonSourceName]: sources[commonSourceName],
  })

  const buildState = async (env?: string): Promise<MultiEnvState> => {
    const elements = new RemoteElementSource(await remoteMapCreator<Element>({
      namespace: getRemoteMapNamespace('merged', env),
      serialize: element => serialize([element]),
      // TODO: we might need to pass static file reviver to the deserialization func
      deserialize: deserializeSingleElement,
    }))
    return {
      elements,
      mergeErrors: await remoteMapCreator<MergeError[]>({
        namespace: getRemoteMapNamespace('errors', env),
        serialize: errors => serialize(errors),
        deserialize: async data => deserializeMergeErrors(data),
      }),
    }
  }

  let state = initState

  const buildMultiEnvState = async ({ env, changes = {} }: {
    env?: string
    changes?: EnvChanges
  }): Promise<{ state: MultiEnvState; changes: Change[] }> => {
    const primaryEnv = env ?? primarySourceName
    const actualChanges = primaryEnv === primarySourceName
      ? changes
      : await mapValuesAsync(sources, src => src.load(false, primarySourceName))
    const current = state !== undefined
      ? state
      : await buildState(env)

    const { newElements, relevantElementIDs } = await getBuildMergeData({
      src1Changes: actualChanges[primaryEnv] ?? [],
      src1: sources[primaryEnv],
      src2Changes: actualChanges[commonSourceName] ?? [],
      src2: sources[commonSourceName],
    })

    const mergeChanges = await buildNewMergedElementsAndErrors({
      newElements: awu(newElements),
      currentElements: current.elements,
      currentErrors: current.mergeErrors,
      relevantElementIDs: awu(relevantElementIDs),
      mergeFunc: async elements => {
        const plainResult = await mergeElements(elements)
        return {
          errors: plainResult.errors,
          merged: mapRemoteMapResult(plainResult.merged,
            async element => {
              const r = await applyInstanceDefaults(
                element,
                { get: async id => (await plainResult.merged.get(id.getFullName()))
                    ?? current.elements.get(id),
                getAll: async () => awu(plainResult.merged.values())
                  .concat(await current.elements.getAll()),
                has: async id => (await plainResult.merged.has(id.getFullName()))
                    || current.elements.has(id),
                list: async () => awu(plainResult.merged.values())
                  .map(e => e.elemID).concat(await current.elements.list()) }
              )
              return r
            }),
        }
      },
    })
    return {
      state: current,
      changes: mergeChanges,
    }
  }

  // const buildMultiEnvState = async (
  //   changes: EnvChanges
  // ): Promise<{
  //   states: Record<string, MultiEnvState>
  //   changes: EnvChanges
  // }> => {
  //   const buildResults = Object.fromEntries(await awu(Object.keys(sources))
  //     .filter(envName => envName !== commonSourceName)
  //     .map(async envName => [envName, await buildMultiEnvState({ changes, env: envName })])
  //     .toArray())
  //   return {
  //     states: _.mapValues(
  //       buildResults,
  //       r => r.state
  //     ),
  //     changes: _.mapValues(
  //       buildResults,
  //       r => r.changes
  //     ),
  //   }
  // }

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

  const buidFullPath = (envName: string, relPath: string): string => (
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
  Promise<EnvChanges> => {
    const secondaryChanges = routedChanges.secondarySources || {}
    return resolveValues({
      [primarySourceName]: primarySource().updateNaclFiles(routedChanges.primarySource || []),
      [commonSourceName]: commonSource().updateNaclFiles(routedChanges.commonSource || []),
      ..._.mapValues(secondaryChanges, (changes, srcName) =>
        secondarySources()[srcName].updateNaclFiles(changes)),
    })
  }

  const updateNaclFiles = async (
    changes: DetailedChange[],
    mode: RoutingMode = 'default'
  ): Promise<Change[]> => {
    const routedChanges = await routeChanges(
      changes,
      primarySource(),
      commonSource(),
      secondarySources(),
      mode
    )
    const elementChanges = await applyRoutedChanges(routedChanges)
    const buildRes = await buildMultiEnvState({ changes: elementChanges })
    state = buildRes.state
    return buildRes.changes
  }

  const getElementsFromSource = async (source: NaclFilesSource):
    Promise<AsyncIterable<ElemID>> => awu((await source.list()))

  const getElementIdsBySelectors = async (selectors: ElementSelector[],
    commonOnly = false): Promise<AsyncIterable<ElemID>> => {
    const relevantSource = commonOnly ? commonSource() : primarySource()
    const elementsFromSource = await getElementsFromSource(relevantSource)
    return selectElementIdsByTraversal(selectors, elementsFromSource, relevantSource)
  }

  const promote = async (ids: ElemID[]): Promise<void> => {
    const routedChanges = await routePromote(
      ids,
      primarySource(),
      commonSource(),
      secondarySources(),
    )
    await applyRoutedChanges(routedChanges)
  }

  const demote = async (ids: ElemID[]): Promise<void> => {
    const routedChanges = await routeDemote(
      ids,
      primarySource(),
      commonSource(),
      secondarySources(),
    )
    await applyRoutedChanges(routedChanges)
  }

  const copyTo = async (ids: ElemID[], targetEnvs: string[] = []): Promise<void> => {
    const targetSources = _.isEmpty(targetEnvs)
      ? secondarySources()
      : _.pick(secondarySources(), targetEnvs)
    const routedChanges = await routeCopyTo(
      ids,
      primarySource(),
      targetSources,
    )
    await applyRoutedChanges(routedChanges)
  }

  const demoteAll = async (): Promise<void> => {
    const commonFileSource = commonSource()
    const routedChanges = await routeDemote(
      await awu(await commonFileSource.list()).toArray(),
      primarySource(),
      commonFileSource,
      secondarySources(),
    )
    await applyRoutedChanges(routedChanges)
  }

  const flush = async (): Promise<void> => {
    await awu([
      primarySource(),
      commonSource(),
      ..._.values(secondarySources()),
    ]).forEach(src => src.flush())
    const currentState = await getState()
    await currentState.elements.flush()
    await currentState.mergeErrors.flush()
  }

  const isEmpty = async (env?: string): Promise<boolean> => (
    (await Promise.all(
      _.values(getActiveSources(env)).filter(s => s !== undefined).map(s => s.isEmpty())
    )).every(e => e)
  )

  const load = async (
    ignoreFileChanges = false,
    _cachePrefix?: string,
    env? : string
  ): Promise<Change[]> => {
    const changes = await mapValuesAsync(sources, (src, name) => {
      if (name === commonSourceName) {
        return src.load(ignoreFileChanges, primarySourceName)
      }
      return src.load()
    })
    const buildResults = await buildMultiEnvState({ changes, env })
    state = buildResults.state
    return buildResults.changes
  }

  return {
    getNaclFile,
    updateNaclFiles,
    flush,
    getElementIdsBySelectors,
    promote,
    demote,
    demoteAll,
    copyTo,
    list: async (): Promise<AsyncIterable<ElemID>> => (await getState()).elements.list(),
    isEmpty,
    get: async (id: ElemID): Promise<Element | Value> => (
      (await getState()).elements.get(id)
    ),
    has: async (id: ElemID): Promise<boolean> => (
      (await getState()).elements.has(id)
    ),
    delete: async (id: ElemID): Promise<void> => (
      (await getState()).elements.delete(id)
    ),
    set: async (elem: Element): Promise<void> => (
      (await getState()).elements.set(elem)
    ),
    getAll: async (env?: string): Promise<AsyncIterable<Element>> => {
      if (env === undefined || env === primarySourceName) {
        return (await getState()).elements.getAll()
      }
      // When we get an env override we don't want to keep that state
      return (await buildMultiEnvState({ env })).state.elements.getAll()
    },
    getElementsSource: async (env?: string) => (
      env === undefined || env === primarySourceName
        ? (await getState()).elements
      // When we get an env override we don't want to keep that state
        : (await buildMultiEnvState({ env })).state.elements
    ),
    listNaclFiles: async (): Promise<string[]> => (
      awu(Object.entries(getActiveSources()))
        .flatMap(async ([prefix, source]) => (
          (await source.listNaclFiles()).map(p => buidFullPath(prefix, p)))).toArray()
    ),
    getTotalSize: async (): Promise<number> => (
      _.sum(await Promise.all(Object.values(sources).map(s => s.getTotalSize())))
    ),
    setNaclFiles: async (...naclFiles: NaclFile[]): Promise<Change[]> => {
      const envNameToNaclFiles = _.groupBy(
        naclFiles, naclFile => getSourceNameForNaclFile(naclFile.filename)
      )
      const envNameToChanges = await mapValuesAsync(envNameToNaclFiles, (envNaclFiles, envName) => {
        const naclFilesWithRelativePath = envNaclFiles.map(naclFile =>
          ({
            ...naclFile,
            filename: getRelativePath(naclFile.filename, envName),
          }))
        return getSourceFromEnvName(envName).setNaclFiles(...naclFilesWithRelativePath)
      })
      const buildRes = await buildMultiEnvState({ changes: envNameToChanges })
      state = buildRes.state
      return buildRes.changes
    },
    removeNaclFiles: async (...names: string[]): Promise<Change[]> => {
      const envNameToFilesToRemove = _.groupBy(names, getSourceNameForNaclFile)
      const envNameToChanges = await mapValuesAsync(envNameToFilesToRemove, (files, envName) =>
        getSourceFromEnvName(envName)
          .removeNaclFiles(...files.map(fileName => getRelativePath(fileName, envName))))
      const buildRes = await buildMultiEnvState({ changes: envNameToChanges })
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
          filename: buidFullPath(prefix, sourceRange.filename),
        }))).toArray()
    ),
    getErrors: async (): Promise<Errors> => {
      const srcErrors = await awu(_.entries(getActiveSources()))
        .map(async ([prefix, source]) => {
          const errors = await source.getErrors()
          return {
            ...errors,
            parse: errors.parse.map(err => ({
              ...err,
              subject: {
                ...err.subject,
                filename: buidFullPath(prefix, err.subject.filename),
              },
              context: err.context && {
                ...err.context,
                filename: buidFullPath(prefix, err.context.filename),
              },
            })),
          }
        })
        .toArray()
      const { mergeErrors } = await getState()
      return new Errors(_.reduce(srcErrors, (acc, errors) => ({
        ...acc,
        parse: [...acc.parse, ...errors.parse],
        merge: [...acc.merge, ...errors.merge],
      }),
      {
        merge: await awu(mergeErrors.values()).flat().toArray(),
        parse: [] as ParseError[],
        validation: [] as ValidationError[],
      }))
    },
    getParsedNaclFile: async (filename: string): Promise<ParsedNaclFile | undefined> => {
      const { source, relPath } = getSourceForNaclFile(filename)
      return source.getParsedNaclFile(relPath)
    },
    getElementNaclFiles: async (id: ElemID): Promise<string[]> => (
      awu(Object.entries(getActiveSources()))
        .flatMap(async ([prefix, source]) => (
          await source.getElementNaclFiles(id)).map(p => buidFullPath(prefix, p)))
        .toArray()
    ),
    getElementReferencedFiles: async (id: ElemID): Promise<string[]> => _.flatten(
      await awu(Object.entries(getActiveSources()))
        .map(async ([prefix, source]) => (
          await source.getElementReferencedFiles(id)).map(p => buidFullPath(prefix, p)))
        .toArray()
    ),
    clear: async (args = { nacl: true, staticResources: true, cache: true }) => {
      // We use series here since we don't want to perform too much delete operation concurrently
      await series([primarySource(), commonSource(), ...Object.values(secondarySources())]
        .map(f => async () => {
          await f.load()
          return f.clear(args)
        }))
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
      state
    ),
    load,
    setCurrentEnv: env => {
      primarySourceName = env
    },
  }
}

export const multiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  primarySourceName: string,
  commonSourceName: string,
  remoteMapCreator: RemoteMapCreator,
): MultiEnvSource => buildMultiEnvSource(
  sources,
  primarySourceName,
  commonSourceName,
  remoteMapCreator
)
