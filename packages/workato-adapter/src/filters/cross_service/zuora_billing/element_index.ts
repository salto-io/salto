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
import { Element } from '@salto-io/adapter-api'
import _ from 'lodash'

export type ZuoraIndex = Record<string, Readonly<Element>[]>

export const indexZuoraByElemId = (elements: ReadonlyArray<Readonly<Element>>): ZuoraIndex =>
  _(elements)
    .groupBy(e => e.elemID.getFullName())
    .entries()
    // Currently we only index objects
    // (metadataType is our way to differ between Zuora objects to the rest of the elements)
    .filter(([_key, group]) => group.some(e => e.annotations.metadataType !== undefined))
    .fromPairs()
    .mapKeys((_val, key) => key.toLowerCase())
    .value()
