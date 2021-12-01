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
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { remoteMap } from '@salto-io/workspace'


export const createMockReadOnlyRemoteMap = <T>()
: MockInterface<remoteMap.ReadOnlyRemoteMap<T>> => ({
    get: mockFunction<remoteMap.ReadOnlyRemoteMap<T>['get']>(),
    has: mockFunction<remoteMap.ReadOnlyRemoteMap<T>['has']>(),
    entries: mockFunction<remoteMap.ReadOnlyRemoteMap<T>['entries']>(),
    values: mockFunction<remoteMap.ReadOnlyRemoteMap<T>['values']>(),
  })
