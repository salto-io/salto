import _ from 'lodash'
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
  fileToSource: Record<string, BlueprintsSource>
}

export const multiEnvSource = (
  primarySource: BlueprintsSource,
  commonSource?: BlueprintsSource,
  secondarySources: Record<string, BlueprintsSource> = {}
): BlueprintsSource => {
  let state: Promise<MultiEnvState>

  const getActiveSources = (): BlueprintsSource[] => (commonSource
    ? [primarySource, commonSource]
    : [primarySource])

  const getFromAllActiveSources = async <T>(
    callback: (bp: BlueprintsSource) => Promise<T[]>,
  ): Promise<T[]> => {
    const activeSources = getActiveSources()
    return _.flatten(await Promise.all(activeSources.map(callback)))
  }

  const buildMutiEnvState = async (): Promise<MultiEnvState> => {
    const blueprintIndex = _.fromPairs(await getFromAllActiveSources(
      async src => (await src.listBlueprints()).map(filename => ([filename, src]))
    ))
    const allActiveElements = await getFromAllActiveSources(s => s.getAll())
    const mergeResult = mergeElements(allActiveElements)
    const elements = _.keyBy(mergeResult.merged, e => e.elemID.getFullName())
    const { errors } = mergeResult
    return {
      elements,
      mergeErrors: errors,
      fileToSource: blueprintIndex,
    }
  }

  state = buildMutiEnvState()

  const getSourceForBlueprint = async (
    filename: string
  ): Promise<BlueprintsSource | undefined> => (await state).fileToSource[filename]

  const getBlueprint = async (filename: string): Promise<Blueprint | undefined> => {
    const source = await getSourceForBlueprint(filename)
    return source && source.getBlueprint(filename)
  }

  const setBlueprint = async (blueprint: Blueprint): Promise<void> => {
    const relevantSource = await getSourceForBlueprint(blueprint.filename) || primarySource
    await relevantSource.setBlueprints(blueprint)
    state = buildMutiEnvState()
  }
  const removeBlueprint = async (filename: string): Promise<void> => {
    const source = await getSourceForBlueprint(filename)
    if (source) {
      await source.removeBlueprints(filename)
      state = buildMutiEnvState()
    }
  }

  const update = async (changes: DetailedChange[], newEnv = false): Promise<void> => {
    if (!commonSource) {
      await primarySource.update(changes)
    } else {
      const routedChanges = await routeChanges(
        changes,
        primarySource,
        commonSource,
        secondarySources,
        newEnv
      )
      const secondaryChanges = routedChanges.secondarySources || {}
      await Promise.all([
        primarySource.update(routedChanges.primarySource || []),
        commonSource.update(routedChanges.commonSource || []),
        ..._.keys(secondaryChanges).map(k => secondarySources[k].update(secondaryChanges[k])),
      ])
    }
    state = buildMutiEnvState()
  }

  const flush = async (): Promise<void> => {
    await Promise.all([
      primarySource.flush(),
      commonSource ? commonSource.flush() : undefined,
      ..._.values(secondarySources).map(src => src.flush()),
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
      _.keys((await state).fileToSource)
    ),
    setBlueprints: async (...blueprints: Blueprint[]): Promise<void> => {
      await Promise.all(blueprints.map(setBlueprint))
      state = buildMutiEnvState()
    },
    removeBlueprints: async (...names: string[]): Promise<void> => {
      await Promise.all(names.map(name => removeBlueprint(name)))
      state = buildMutiEnvState()
    },
    getSourceMap: async (filename: string): Promise<SourceMap> => (
      (await getSourceForBlueprint(filename))?.getSourceMap(filename)
        ?? new Map<string, SourceRange[]>()
    ),
    getSourceRanges: async (elemID: ElemID): Promise<SourceRange[]> => (
      getFromAllActiveSources(src => src.getSourceRanges(elemID))
    ),
    getErrors: async (): Promise<Errors> => {
      const srcErrors = await Promise.all((await getActiveSources()).map(src => src.getErrors()))
      return new Errors(_.reduce(srcErrors, (acc, errors) => {
        acc.parse = [...acc.parse, ...errors.parse]
        acc.merge = [...acc.merge, ...errors.merge]
        acc.validation = [...acc.validation, ...errors.validation]
        return acc
      },
      {
        parse: [] as ParseError[],
        merge: [] as MergeError[],
        validation: [] as ValidationError[],
      }))
    },
    getElements: async (filename: string): Promise<Element[]> => (
      (await getSourceForBlueprint(filename))?.getElements(filename) ?? []
    ),
  }
}
