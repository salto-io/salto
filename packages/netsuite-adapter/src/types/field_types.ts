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
import { ElemID, PrimitiveType, PrimitiveTypes } from '@salto-io/adapter-api'
import { FIELD_TYPES_PATH, NETSUITE, SUBTYPES_PATH, TYPES_PATH } from '../constants'

export const fieldTypes = {
  cdata: new PrimitiveType({
    elemID: new ElemID(NETSUITE, 'cdata'),
    primitive: PrimitiveTypes.STRING,
    path: [NETSUITE, TYPES_PATH, SUBTYPES_PATH, FIELD_TYPES_PATH],
  }),
  fileContent: new PrimitiveType({
    elemID: new ElemID(NETSUITE, 'fileContent'),
    primitive: PrimitiveTypes.STRING,
    path: [NETSUITE, TYPES_PATH, SUBTYPES_PATH, FIELD_TYPES_PATH],
  }),
}
