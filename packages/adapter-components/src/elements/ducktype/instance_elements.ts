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
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { toBasicInstance, InstanceCreationParams } from '../instance_elements'

/**
 * Generate an instance for a single entry returned for a given type.
 *
 * - Special case: If hasDynamicFields is specified, then the entry is
 *    nested under a 'value' field in order to allow the type to define
 *    this as a map type.
 */
export const toInstance = async (
  args: InstanceCreationParams & {
    hasDynamicFields?: boolean
  },
): Promise<InstanceElement | undefined> => {
  const inst = await toBasicInstance({
    ...args,
    entry: args.hasDynamicFields ? { value: args.entry } : args.entry,
  })
  if (_.isEmpty(inst.value)) {
    return undefined
  }
  return inst
}
