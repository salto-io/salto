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
export const FORCE_ACCEPT_LANGUAGE_HEADERS = {
  'Accept-Language': 'en-US',
  'X-Force-Accept-Language': 'true',
}

export const PRIVATE_API_HEADERS = {
  'X-Atlassian-Token': 'no-check',
}

export const JSP_API_HEADERS = {
  ...PRIVATE_API_HEADERS,
  'Content-Type': 'application/x-www-form-urlencoded',
}
