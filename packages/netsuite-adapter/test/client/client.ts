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
import NetsuiteClient from '../../src/client/client'

const DUMMY_ACCOUNT_ID = 'dummyAccountId'
const DUMMY_TOKEN_ID = 'dummyTokenId'
const DUMMY_TOKEN_SECRET = 'dummyTokenSecret'

export const DUMMY_CREDENTIALS = {
  accountId: DUMMY_ACCOUNT_ID,
  tokenId: DUMMY_TOKEN_ID,
  tokenSecret: DUMMY_TOKEN_SECRET,
}
const mockClient = (): NetsuiteClient =>
  new NetsuiteClient({
    credentials: DUMMY_CREDENTIALS,
  })

export default mockClient
