import _ from 'lodash'
import path from 'path'

import { Element, ElemID, getChangeElement, Value } from 'adapter-api'
import { ParseError, SourceMap, SourceRange } from 'src/parser/parse'
import { ValidationError } from 'src/core/validator'
import { mergeElements, MergeError } from '../../../core/merger'
import { DetailedChange } from '../../../core/plan'
import { routeChanges } from './routers'
import { BlueprintsSource, Blueprint } from '../blueprints_source'
import { Errors } from '../../errors'

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

export const multiEnvSource = (
  sources: Record<string, BlueprintsSource>,
  primarySourcePrefix: string,
  commonSourcePrefix: string,
): BlueprintsSource => {
  let state: Promise<MultiEnvState>

  const primarySource = (): BlueprintsSource => sources[primarySourcePrefix]
  const commonSource = (): BlueprintsSource => sources[commonSourcePrefix]
  const secondarySources = (): Record<string, BlueprintsSource> => (
    _.omit(sources, [primarySourcePrefix, commonSourcePrefix])
  )

  const getActiveSources = (): BlueprintsSource[] => [primarySource(), commonSource()]

  const getFromAllActiveSources = async <T>(
    callback: (bp: BlueprintsSource) => Promise<T[]>,
  ): Promise<T[]> => {
    const activeSources = getActiveSources()
    return _.flatten(await Promise.all(activeSources.map(callback)))
  }

  const buildMutiEnvState = async (): Promise<MultiEnvState> => {
    const allActiveElements = await getFromAllActiveSources(s => s.getAll())
    const mergeResult = mergeElements(allActiveElements)
    const elements = _.keyBy(mergeResult.merged, e => e.elemID.getFullName())
    const { errors } = mergeResult
    return {
      elements,
      mergeErrors: errors,
    }
  }

  state = buildMutiEnvState()

  const getSourceForBlueprint = (
    filename: string
  ): {source: BlueprintsSource; relPath: string} => {
    const [prefix, source] = _.entries(sources)
      .find(([key, _v]) => key !== commonSourcePrefix && filename.startsWith(key)) || []
    return prefix && source
      ? { relPath: filename.slice(prefix.length + 1), source }
      : { relPath: filename, source: commonSource() }
  }
  const getBlueprint = async (filename: string): Promise<Blueprint | undefined> => {
    const { source, relPath } = getSourceForBlueprint(filename)
    return source.getBlueprint(relPath)
  }

  const setBlueprint = async (blueprint: Blueprint): Promise<void> => {
    const { source, relPath } = getSourceForBlueprint(blueprint.filename)
    await source.setBlueprints({ ...blueprint, filename: relPath })
    state = buildMutiEnvState()
  }
  const removeBlueprint = async (filename: string): Promise<void> => {
    const { source, relPath } = getSourceForBlueprint(filename)
    await source.removeBlueprints(relPath)
    state = buildMutiEnvState()
  }

  const update = async (changes: DetailedChange[], newEnv = false): Promise<void> => {
    if (!commonSource) {
      await primarySource().update(changes)
    } else {
      const routedChanges = await routeChanges(
        changes,
        primarySource(),
        commonSource(),
        secondarySources(),
        newEnv
      )
      const secondaryChanges = routedChanges.secondarySources || {}
      await Promise.all([
        primarySource().update(routedChanges.primarySource || []),
        commonSource().update(routedChanges.commonSource || []),
        ..._.keys(secondaryChanges).map(k => secondarySources()[k].update(secondaryChanges[k])),
      ])
    }
    state = buildMutiEnvState()
  }

  const flush = async (): Promise<void> => {
    await Promise.all([
      primarySource().flush(),
      commonSource ? commonSource().flush() : undefined,
      ..._.values(secondarySources()).map(src => src.flush()),
    ])
  }

  return {
    getBlueprint,
    update,
    flush,
    list: async (): Promise<ElemID[]> => _.values((await state).elements).map(e => e.elemID),
    get: async (id: ElemID): Promise<Element | Value> => (
      (await state).elements[id.getFullName()]
    ),
    getAll: async (): Promise<Element[]> => _.values((await state).elements),
    listBlueprints: async (): Promise<string[]> => (
      _.flatten(await Promise.all(_.entries(sources)
        .map(async ([prefix, source]) => (
          await source.listBlueprints()).map(p => path.join(prefix, p)))))
    ),
    setBlueprints: async (...blueprints: Blueprint[]): Promise<void> => {
      await Promise.all(blueprints.map(setBlueprint))
      state = buildMutiEnvState()
    },
    removeBlueprints: async (...names: string[]): Promise<void> => {
      await Promise.all(names.map(name => removeBlueprint(name)))
      state = buildMutiEnvState()
    },
    getSourceMap: async (filename: string): Promise<SourceMap> => {
      const { source, relPath } = getSourceForBlueprint(filename)
      return source.getSourceMap(relPath) || new Map<string, SourceRange[]>()
    },
    getSourceRanges: async (elemID: ElemID): Promise<SourceRange[]> => (
      _.flatten(await Promise.all(_.entries(sources)
        .map(async ([prefix, source]) =>
          (await source.getSourceRanges(elemID)).map(sourceRange => (
            { filename: path.join(prefix, sourceRange.filename), ...sourceRange })))))
    ),
    getErrors: async (): Promise<Errors> => {
      const srcErrors = _.flatten(await Promise.all(_.entries(sources)
        .map(async ([prefix, source]) => {
          const errors = await source.getErrors()
          return {
            ...errors,
            parse: errors.parse.map(err => ({
              ...err,
              subject: {
                ...err.subject,
                filename: path.join(prefix, err.subject.filename),
              },
              context: err.context && {
                ...err.context,
                filename: path.join(prefix, err.context.filename),
              },
            })),
          }
        })))
      return new Errors(_.reduce(srcErrors, (acc, errors) => {
        acc.parse = [...acc.parse, ...errors.parse]
        acc.merge = [...acc.merge, ...errors.merge]
        acc.validation = []
        return acc
      },
      {
        parse: [] as ParseError[],
        merge: [] as MergeError[],
        validation: [] as ValidationError[],
      }))
    },
    getElements: async (filename: string): Promise<Element[]> => {
      const { source, relPath } = getSourceForBlueprint(filename)
      return source.getElements(relPath) ?? []
    },
  }
}
