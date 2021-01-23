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
import { PrimitiveType, ElemID, Values, isPrimitiveType } from '@salto-io/adapter-api'
import { MergeResult, MergeError } from './common'
import { serialize, deserialize } from '../../serializer/elements'


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

  serialize = (): string => JSON.stringify({
    type: MultiplePrimitiveTypesUnsupportedError.name,
    args: { elemID: this.elemID.getFullName(), duplicates: serialize(this.duplicates) },
  })

  static deserialize = async (data: Values): Promise<MultiplePrimitiveTypesUnsupportedError> => {
    const duplicates = await deserialize(data.duplicates)
    const primitiveTypesDuplicates = duplicates.filter(isPrimitiveType)
    if (primitiveTypesDuplicates.length !== duplicates.length) {
      throw new Error('Deserialization failed. Not all of the duplicates are primitive types')
    }
    return new MultiplePrimitiveTypesUnsupportedError({
      elemID: data.elemID,
      duplicates: primitiveTypesDuplicates,
    })
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
): MergeResult<PrimitiveType> => mergePrimitiveDefinitions(primitives[0], primitives)
