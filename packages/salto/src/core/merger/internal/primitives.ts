import _ from 'lodash'
import { PrimitiveType, ElemID } from 'adapter-api'
import { logger } from '@salto/logging'
import { MergeResult, MergeError } from './common'

const log = logger(module)

export class MultiplePrimitiveTypesUnsupportedError extends MergeError {
  readonly duplicates: PrimitiveType[]
  constructor(
    { elemID, duplicates }:
      { elemID: ElemID; duplicates: PrimitiveType[] }
  ) {
    super({
      elemID,
      error: [
        'Merging for primitive types is not supported',
        `Found duplicated element ${duplicates[0].elemID.getFullName()}`,
      ].join('. '),
    })
    this.duplicates = duplicates
  }
}

const mergePrimitiveDefinitions = (
  { elemID }: { elemID: ElemID }, primitives: PrimitiveType[],
): MergeResult<PrimitiveType> => ({
  merged: primitives[0],
  errors: primitives.length > 1
    ? [new MultiplePrimitiveTypesUnsupportedError({ elemID, duplicates: primitives })]
    : [],
})

export const mergePrimitives = (
  primitives: PrimitiveType[]
): MergeResult<Record<string, PrimitiveType>> => {
  const mergeResults = _(primitives)
    .groupBy(p => p.elemID.getFullName())
    .mapValues(primitiveGroup => mergePrimitiveDefinitions(primitiveGroup[0], primitiveGroup))
    .value()

  const merged = _.mapValues(mergeResults, r => r.merged)
  const errors = _.flatten(_.values(mergeResults).map(r => r.errors))
  log.debug(`merged ${primitives.length} primitives to ${merged.length} elements [errors=${
    errors.length}]`)
  return { merged, errors }
}
