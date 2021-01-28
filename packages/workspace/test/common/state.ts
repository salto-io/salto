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
import { Element } from '@salto-io/adapter-api'
import { PathIndex } from '../../src/workspace/path_index'
import { State, buildInMemState } from '../../src/workspace/state'

export const mockState = (
  elements: Element[] = [],
): State => (
  buildInMemState(async () => ({
    elements: _.keyBy(elements, elem => elem.elemID.getFullName()),
    pathIndex: new PathIndex(),
    servicesUpdateDate: {},
    saltoVersion: '0.0.1',
  }))
)
