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

import { Element, ElemID, getChangeElement, isInstanceElement, Value,
  DetailedChange, Change, isRemovalChange } from '@salto-io/adapter-api'
import { applyInstancesDefaults } from '@salto-io/adapter-utils'
import { promises, values } from '@salto-io/lowerdash'
import { ElementSelector, selectElementIdsByTraversal,
  ElementIDToValue } from '../../element_selector'
import { ValidationError } from '../../../validator'
import { ParseError, SourceRange, SourceMap } from '../../../parser'

import { mergeElements, MergeError } from '../../../merger'
import { routeChanges, RoutedChanges, routePromote, routeDemote, routeCopyTo } from './routers'
import { NaclFilesSource, NaclFile, RoutingMode, ParsedNaclFile } from '../nacl_files_source'
import { buildNewMergedElementsAndErrors } from '../elements_cache'
import { Errors } from '../../errors'

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
  elements: Record<string, Element>
  mergeErrors: MergeError[]
}

type MultiEnvSource = Omit<NaclFilesSource, 'getAll'> & {
  getAll: (env?: string) => Promise<Element[]>
  promote: (ids: ElemID[]) => Promise<void>
  getElementIdsBySelectors: (
    selectors: ElementSelector[],
    commonOnly?: boolean,
    validateDeterminedSelectors?: boolean,
  ) => Promise<ElemID[]>
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

  const getAfterFromChange = (change: Change):
  [string, Element | undefined] => {
    const changeElem = getChangeElement(change)
    return [
      changeElem.elemID.getFullName(),
      isRemovalChange(change) ? undefined : changeElem,
    ]
  }

  const getRelevantElems = async (
    envElemIDsToElems: Record<string, Record<string, Element | undefined>>,
    relevantElementIDs: string[],
  ): Promise<Element[]> => (await Promise.all(
    Object.entries(envElemIDsToElems).flatMap(([envName, elemIDToElems]) =>
      relevantElementIDs.map(async id =>
        (id in elemIDToElems
          ? elemIDToElems[id]
          : sources[envName].get(ElemID.fromFullName(id)))))
  )).filter(values.isDefined)

  const buildState = async (env?: string): Promise<MultiEnvState> => {
    const allActiveElements = _.flatten(await Promise.all(
      _.values(getActiveSources(env)).map(s => (s ? s.getAll() : []))
    ))
    const { errors, merged } = mergeElements(allActiveElements, {})
    applyInstancesDefaults(merged.filter(isInstanceElement))
    return {
      elements: _.keyBy(merged, e => e.elemID.getFullName()),
      mergeErrors: errors,
    }
  }

  let state = initState
  const buildMultiEnvState = async ({ env, changes = {} }: {
    env?: string
    changes?: Record<string, Change[]>
  }): Promise<{ state: MultiEnvState; changes: Change[] }> => {
    const primaryEnv = env ?? primarySourceName
    if (state === undefined || primaryEnv !== primarySourceName) {
      return { state: await buildState(env), changes: [] }
    }
    const current = await state
    const relevantElementIDs = _.uniq(
      Object.values(changes).flat().map(getChangeElement).map(e => e.elemID.getFullName())
    )
    const envs = [commonSourceName, primaryEnv]
    const changedElementsByEnv = _.mapValues(
      _.pick(changes, envs),
      envChanges => Object.fromEntries(envChanges.map(getAfterFromChange))
    )
    envs.forEach(name => { changedElementsByEnv[name] = changedElementsByEnv[name] ?? {} })
    const newElements = (await getRelevantElems(changedElementsByEnv, relevantElementIDs)).flat()
    const mergeResult = buildNewMergedElementsAndErrors({
      newElements,
      currentElements: current.elements,
      currentMergeErrors: current.mergeErrors,
      relevantElementIDs,
    })
    return {
      state: { elements: mergeResult.mergedElements, mergeErrors: mergeResult.mergeErrors },
      changes: mergeResult.changes,
    }
  }

  const getState = (): Promise<MultiEnvState> => {
    if (_.isUndefined(state)) {
      state = buildMultiEnvState({}).then(res => res.state)
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
  Promise<Record<string, Change[]>> => {
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
    state = Promise.resolve(buildRes.state)
    return buildRes.changes
  }

  const getElementsFromSource = async (source: NaclFilesSource): Promise<ElementIDToValue[]> =>
    (await source.getAll()).map(elem => ({ elemID: elem.elemID, element: elem }))

  const getElementIdsBySelectors = async (
    selectors: ElementSelector[], commonOnly = false,
  ): Promise<ElemID[]> =>
    selectElementIdsByTraversal(
      selectors,
      await getElementsFromSource(
        commonOnly
          ? commonSource()
          : primarySource()
      ),
      false,
    )

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
      await commonFileSource.list(),
      primarySource(),
      commonFileSource,
      secondarySources(),
    )
    await applyRoutedChanges(routedChanges)
  }

  const flush = async (): Promise<void> => {
    await Promise.all([
      primarySource().flush(),
      commonSource().flush(),
      ..._.values(secondarySources()).map(src => src.flush()),
    ])
  }

  const isEmpty = async (env?: string): Promise<boolean> => (
    (await Promise.all(
      _.values(getActiveSources(env)).filter(s => s !== undefined).map(s => s.isEmpty())
    )).every(e => e)
  )

  return {
    getNaclFile,
    updateNaclFiles,
    flush,
    getElementIdsBySelectors,
    promote,
    demote,
    demoteAll,
    copyTo,
    list: async (): Promise<ElemID[]> => _.values((await getState()).elements).map(e => e.elemID),
    isEmpty,
    get: async (id: ElemID): Promise<Element | Value> => (
      (await getState()).elements[id.getFullName()]
    ),
    getAll: async (env?: string): Promise<Element[]> => (
      env === undefined || env === primarySourceName
        ? _.values((await getState()).elements)
        // When we get an env override we don't want to keep that state
        : _.values((await buildMultiEnvState({ env })).state.elements)
    ),
    listNaclFiles: async (): Promise<string[]> => (
      _.flatten(await Promise.all(_.entries(getActiveSources())
        .map(async ([prefix, source]) => (
          await source.listNaclFiles()).map(p => buidFullPath(prefix, p)))))
    ),
    getTotalSize: async (): Promise<number> =>
      _.sum(await Promise.all(Object.values(sources).map(s => s.getTotalSize()))),
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
      state = Promise.resolve(buildRes.state)
      return buildRes.changes
    },
    removeNaclFiles: async (...names: string[]): Promise<Change[]> => {
      const envNameToFilesToRemove = _.groupBy(names, getSourceNameForNaclFile)
      const envNameToChanges = await mapValuesAsync(envNameToFilesToRemove, (files, envName) =>
        getSourceFromEnvName(envName)
          .removeNaclFiles(...files.map(fileName => getRelativePath(fileName, envName))))
      const buildRes = await buildMultiEnvState({ changes: envNameToChanges })
      state = Promise.resolve(buildRes.state)
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
    getParsedNaclFile: async (filename: string): Promise<ParsedNaclFile | undefined> => {
      const { source, relPath } = getSourceForNaclFile(filename)
      return source.getParsedNaclFile(relPath)
    },
    getElementNaclFiles: async (id: ElemID): Promise<string[]> => (
      _.flatten(await Promise.all(_.entries(getActiveSources())
        .map(async ([prefix, source]) => (
          await source.getElementNaclFiles(id)).map(p => buidFullPath(prefix, p)))))
    ),
    getElementReferencedFiles: async (id: ElemID): Promise<string[]> => _.flatten(
      await Promise.all(_.entries(getActiveSources())
        .map(async ([prefix, source]) => (
          await source.getElementReferencedFiles(id)).map(p => buidFullPath(prefix, p))))
    ),
    clear: async (args = { nacl: true, staticResources: true, cache: true }) => {
      // We use series here since we don't want to perform too much delete operation concurrently
      await series([primarySource(), commonSource(), ...Object.values(secondarySources())]
        .map(f => () => f.clear(args)))
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
      state
    ),
  }
}

export const multiEnvSource = (
  sources: Record<string, NaclFilesSource>,
  primarySourceName: string,
  commonSourceName: string,
): MultiEnvSource => buildMultiEnvSource(sources, primarySourceName, commonSourceName)
