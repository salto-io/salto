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

import { getMD5FromBuffer } from '../src/files'

describe('Files', () => {
  it('should calculate MD5 from buffer', () =>
    expect(getMD5FromBuffer(Buffer.from('ZOMG'))).toEqual('4dc55a74daa147a028360ee5687389d7'))
})
