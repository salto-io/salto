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
import path from 'path'
import wu from 'wu'

import { Element, ElemID, getChangeElement, isInstanceElement, Value,
  DetailedChange } from '@salto-io/adapter-api'
import { applyInstancesDefaults } from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import { ValidationError } from '../../../validator'
import { ParseError, SourceRange, SourceMap } from '../../../parser'

import { mergeElements, MergeError } from '../../../merger'
import { routeChanges, RoutedChanges, routePromote, routeDemote, routeCopyTo } from './routers'
import { NaclFilesSource, NaclFile, RoutingMode } from '../nacl_files_source'
import { Errors } from '../../errors'

const { series } = promises.array

export const ENVS_PREFIX = 'envs'

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
  elements: Record<string, Element>
  mergeErrors: MergeError[]
}

type MultiEnvSource = Omit<NaclFilesSource, 'getAll'> & {
  getAll: (env?: string) => Promise<Element[]>
  promote: (ids: ElemID[]) => Promise<void>
  demote: (ids: ElemID[]) => Promise<void>
  demoteAll: () => Promise<void>
  copyTo: (ids: ElemID[], targetEnvs?: string[]) => Promise<void>
}

const buildMultiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  primarySourceName: string,
  commonSourceName: string,
  initState?: Promise<MultiEnvState>
): MultiEnvSource => {
  const primarySource = (): NaclFilesSource => sources[primarySourceName]
  const commonSource = (): NaclFilesSource => sources[commonSourceName]
  const secondarySources = (): Record<string, NaclFilesSource> => (
    _.omit(sources, [primarySourceName, commonSourceName])
  )

  const getActiveSources = (env?: string): Record<string, NaclFilesSource> => ({
    [primarySourceName]: env === undefined ? sources[primarySourceName] : sources[env],
    [commonSourceName]: sources[commonSourceName],
  })

  const buildMutiEnvState = async (env?: string): Promise<MultiEnvState> => {
    const allActiveElements = _.flatten(await Promise.all(
      _.values(getActiveSources(env)).map(s => (s ? s.getAll() : []))
    ))
    const { errors, merged } = mergeElements(allActiveElements)
    applyInstancesDefaults(merged.filter(isInstanceElement))
    return {
      elements: _.keyBy(merged, e => e.elemID.getFullName()),
      mergeErrors: errors,
    }
  }

  let state = initState
  const getState = (): Promise<MultiEnvState> => {
    if (_.isUndefined(state)) {
      state = buildMutiEnvState()
    }
    return state
  }

  const getSourcePrefixForNaclFile = (fullName: string): string | undefined => {
    const isContained = (relPath: string, basePath: string): boolean => {
      const baseDirParts = basePath.split(path.sep)
      const relPathParts = relPath.split(path.sep)
      return _.isEqual(baseDirParts, relPathParts.slice(0, baseDirParts.length))
    }

    return Object.keys(sources).filter(srcPrefix => srcPrefix !== commonSourceName)
      .find(srcPrefix => isContained(fullName, path.join(ENVS_PREFIX, srcPrefix)))
  }

  const getSourceFromPrefix = (prefix?: string): NaclFilesSource =>
    (prefix && sources[prefix] ? sources[prefix] : commonSource())

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
    const prefix = getSourcePrefixForNaclFile(fullName)
    return { relPath: getRelativePath(fullName, prefix), source: getSourceFromPrefix(prefix) }
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

  const applyRoutedChanges = async (routedChanges: RoutedChanges): Promise<void> => {
    const secondaryChanges = routedChanges.secondarySources || {}
    await Promise.all([
      primarySource().updateNaclFiles(routedChanges.primarySource || []),
      commonSource().updateNaclFiles(routedChanges.commonSource || []),
      ..._.keys(secondaryChanges)
        .map(srcName => secondarySources()[srcName].updateNaclFiles(secondaryChanges[srcName])),
    ])
    state = buildMutiEnvState()
  }

  const updateNaclFiles = async (
    changes: DetailedChange[],
    mode: RoutingMode = 'default'
  ): Promise<void> => {
    const routedChanges = await routeChanges(
      changes,
      primarySource(),
      commonSource(),
      secondarySources(),
      mode
    )
    return applyRoutedChanges(routedChanges)
  }

  const promote = async (ids: ElemID[]): Promise<void> => {
    const routedChanges = await routePromote(
      ids,
      primarySource(),
      commonSource(),
      secondarySources(),
    )
    return applyRoutedChanges(routedChanges)
  }

  const demote = async (ids: ElemID[]): Promise<void> => {
    const routedChanges = await routeDemote(
      ids,
      primarySource(),
      commonSource(),
      secondarySources(),
    )
    return applyRoutedChanges(routedChanges)
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
    return applyRoutedChanges(routedChanges)
  }

  const demoteAll = async (): Promise<void> => {
    const commonFileSource = commonSource()
    const routedChanges = await routeDemote(
      await commonFileSource.list(),
      primarySource(),
      commonFileSource,
      secondarySources(),
    )
    return applyRoutedChanges(routedChanges)
  }

  const flush = async (): Promise<void> => {
    await Promise.all([
      primarySource().flush(),
      commonSource().flush(),
      ..._.values(secondarySources()).map(src => src.flush()),
    ])
  }

  return {
    getNaclFile,
    updateNaclFiles,
    flush,
    promote,
    demote,
    demoteAll,
    copyTo,
    list: async (): Promise<ElemID[]> => _.values((await getState()).elements).map(e => e.elemID),
    get: async (id: ElemID): Promise<Element | Value> => (
      (await getState()).elements[id.getFullName()]
    ),
    getAll: async (env?: string): Promise<Element[]> => (env === undefined
      ? _.values((await getState()).elements)
      // When we get an env override we don't want to keep that state
      : _.values((await buildMutiEnvState(env)).elements)),
    listNaclFiles: async (): Promise<string[]> => (
      _.flatten(await Promise.all(_.entries(getActiveSources())
        .map(async ([prefix, source]) => (
          await source.listNaclFiles()).map(p => buidFullPath(prefix, p)))))
    ),
    getTotalSize: async (): Promise<number> =>
      _.sum(await Promise.all(Object.values(sources).map(s => s.getTotalSize()))),
    setNaclFiles: async (...naclFiles: NaclFile[]): Promise<void> => {
      await Promise.all(Object.entries(_.groupBy(naclFiles,
        naclFile => getSourcePrefixForNaclFile(naclFile.filename)))
        .map(([prefix, sourceNaclFiles]) => getSourceFromPrefix(prefix)
          .setNaclFiles(...sourceNaclFiles.map(naclFile =>
            ({ ...naclFile, filename: getRelativePath(naclFile.filename, prefix) })))))
      state = buildMutiEnvState()
    },
    removeNaclFiles: async (...names: string[]): Promise<void> => {
      await Promise.all(Object.entries(_.groupBy(names, getSourcePrefixForNaclFile))
        .map(([prefix, sourceNames]) => getSourceFromPrefix(prefix)
          .removeNaclFiles(...sourceNames.map(fullName => getRelativePath(fullName, prefix)))))
      state = buildMutiEnvState()
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
      _.flatten(await Promise.all(_.entries(getActiveSources())
        .map(async ([prefix, source]) =>
          (await source.getSourceRanges(elemID)).map(sourceRange => (
            { ...sourceRange, filename: buidFullPath(prefix, sourceRange.filename) })))))
    ),
    getErrors: async (): Promise<Errors> => {
      const srcErrors = _.flatten(await Promise.all(_.entries(getActiveSources())
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
        })))
      const { mergeErrors } = await getState()
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
    },
    getElements: async (filename: string): Promise<Element[]> => {
      const { source, relPath } = getSourceForNaclFile(filename)
      return source.getElements(relPath) ?? []
    },
    getElementNaclFiles: async (id: ElemID): Promise<string[]> => (
      _.flatten(await Promise.all(_.entries(getActiveSources())
        .map(async ([prefix, source]) => (
          await source.getElementNaclFiles(id)).map(p => buidFullPath(prefix, p)))))
    ),
    clear: async (): Promise<void> => {
      // We use series here since we don't want to perform too much delete operation concurrently
      await series([primarySource(), commonSource(), ...Object.values(secondarySources())]
        .map(f => () => f.clear()))
    },
    rename: async (name: string): Promise<void> => {
      await series([primarySource(), commonSource(), ...Object.values(secondarySources())]
        .map(f => () => f.rename(name)))
    },
    clone: () => buildMultiEnvSource(
      _.mapValues(sources, source => source.clone()),
      primarySourceName,
      commonSourceName,
      state
    ),
  }
}

export const multiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  primarySourceName: string,
  commonSourceName: string,
): MultiEnvSource => buildMultiEnvSource(sources, primarySourceName, commonSourceName)
