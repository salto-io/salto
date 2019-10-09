import _ from 'lodash'

import {
  PrimitiveType, ElemID,
} from 'adapter-api'

import {
  MergeResult, MergeError,
} from './common'

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

  return {
    merged: _.mapValues(mergeResults, r => r.merged),
    errors: _.flatten(_.values(mergeResults).map(r => r.errors)),
  }
}
