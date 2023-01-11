/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { StaticFilesCache } from '../../src/workspace/static_files/cache'

export const mockStaticFilesCache = (): MockInterface<StaticFilesCache> => ({
  get: mockFunction<StaticFilesCache['get']>().mockResolvedValue(undefined),
  put: mockFunction<StaticFilesCache['put']>(),
  flush: mockFunction<StaticFilesCache['flush']>(),
  clear: mockFunction<StaticFilesCache['clear']>(),
  rename: mockFunction<StaticFilesCache['rename']>(),
  clone: mockFunction<StaticFilesCache['clone']>(),
  list: mockFunction<StaticFilesCache['list']>(),
})
