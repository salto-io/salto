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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Values, ElemID } from '@salto-io/adapter-api'
import { MergeError, DuplicateAnnotationError } from './common'
import { DuplicateInstanceKeyError } from './instances'
import { DuplicateAnnotationFieldDefinitionError, ConflictingFieldTypesError,
  ConflictingSettingError, DuplicateAnnotationTypeError } from './object_types'
import { DuplicateVariableNameError } from './variables'
import { MultiplePrimitiveTypesUnsupportedError } from './primitives'

type deserializeFunc = (data: Values) => Promise<MergeError>

const MERGE_ERROR_NAME_TO_DESERIALIZE_FUNC: Record<string, deserializeFunc> = {
  [DuplicateAnnotationError.name]: (args: Values) =>
    Promise.resolve(new DuplicateAnnotationError(args as any)),
  [DuplicateInstanceKeyError.name]: (args: Values) =>
    Promise.resolve(new DuplicateInstanceKeyError(args as any)),
  [DuplicateAnnotationFieldDefinitionError.name]: (args: Values) =>
    Promise.resolve(new DuplicateAnnotationFieldDefinitionError(args as any)),
  [ConflictingFieldTypesError.name]: (args: Values) =>
    Promise.resolve(new ConflictingFieldTypesError(args as any)),
  [ConflictingSettingError.name]: (args: Values) =>
    Promise.resolve(new ConflictingSettingError(args as any)),
  [DuplicateAnnotationTypeError.name]: (args: Values) =>
    Promise.resolve(new DuplicateAnnotationTypeError(args as any)),
  [MultiplePrimitiveTypesUnsupportedError.name]:
    MultiplePrimitiveTypesUnsupportedError.deserialize,
  [DuplicateVariableNameError.name]: (args: Values) =>
    Promise.resolve(new DuplicateVariableNameError(args as any)),
}

export const serialize = (mergeErrors: MergeError[]): string =>
  JSON.stringify(mergeErrors.map(me => me.serialize()))

export const deserialize = async (data: string): Promise<MergeError[]> =>
  Promise.all(JSON.parse(data)
    .map((me: string) => JSON.parse(me))
    .map(async (me: Values) =>
      MERGE_ERROR_NAME_TO_DESERIALIZE_FUNC[me.type]({
        ...me.args,
        elemID: ElemID.fromFullName(me.args.elemID),
      })))
