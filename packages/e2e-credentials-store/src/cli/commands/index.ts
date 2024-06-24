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
import register from './register'
import unregister from './unregister'
import list from './list'
import adapters from './adapters'
import clear from './clear'
import free from './free'
import lease from './lease'

const commands = {
  register,
  unregister,
  list,
  adapters,
  clear,
  free,
  lease,
}

export default commands
