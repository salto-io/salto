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
import { PrimitiveType, ElemID, PrimitiveTypes } from '@salto-io/adapter-api'
import _ from 'lodash'
import { MergeResult, MergeError, mergeNoDuplicates } from './common'
import { DuplicateAnnotationTypeError } from './object_types'

export class MultiplePrimitiveTypesError extends MergeError {
  readonly duplicates: PrimitiveType[]
  constructor({ elemID, duplicates }: { elemID: ElemID; duplicates: PrimitiveType[] }) {
    super({
      elemID,
      error: [
        'Merging for primitive types with different primitives is not supported',
        `Found duplicated element ${duplicates[0].elemID.getFullName()}`,
      ].join('. '),
    })
    this.duplicates = duplicates
  }
}

const mergePrimitiveDefinitions = (
  { elemID, primitive }: { elemID: ElemID; primitive: PrimitiveTypes },
  primitives: PrimitiveType[],
): MergeResult<PrimitiveType> => {
  const annotationsMergeResults = mergeNoDuplicates(
    primitives.map(prim => prim.annotations),
    key => new DuplicateAnnotationTypeError({ elemID, key }),
  )

  const annotationTypesMergeResults = mergeNoDuplicates(
    primitives.map(prim => prim.annotationRefTypes),
    key => new DuplicateAnnotationTypeError({ elemID, key }),
  )

  const primitiveType = primitives[0].primitive
  const primitveTypeErrors = _.every(
    primitives.map(prim => prim.primitive),
    prim => prim === primitiveType,
  )
    ? []
    : [
        new MultiplePrimitiveTypesError({
          elemID: primitives[0].elemID,
          duplicates: primitives,
        }),
      ]

  return {
    merged: new PrimitiveType({
      elemID,
      primitive,
      annotationRefsOrTypes: annotationTypesMergeResults.merged,
      annotations: annotationsMergeResults.merged,
    }),
    errors: [...annotationsMergeResults.errors, ...annotationTypesMergeResults.errors, ...primitveTypeErrors],
  }
}

export const mergePrimitives = (primitives: PrimitiveType[]): MergeResult<PrimitiveType> =>
  mergePrimitiveDefinitions(primitives[0], primitives)
