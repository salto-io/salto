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
import { types } from '@salto-io/lowerdash'

/**
 * Use this type to specify a default with customizations by key (usually type).
 * This should be supplemented with merge logic - specifically, the final definition for a key
 * is the customization if available, and otherwise it is the default.
 * Note that there are some edge cases - merging should be done based on mergeSingleDefWithDefault.
 */
export type DefaultWithCustomizations<T, K extends string = string> = {
  // if the customization is an array, the default will be applied to each array item
  // (if the customization is empty, it will not be used)
  default?: types.RecursivePartial<T extends (infer U)[] ? U : T>
  // hack to avoid requiring all keys of an enum
  customizations: string extends K ? Record<K, T> : Partial<Record<K, T>>
}

export type ArgsWithCustomizer<ResponseType, Args, Input = unknown, AdditionalArgs = {}> = Args & {
  custom?: ((args: Partial<Args> & AdditionalArgs) => (input: Input) => ResponseType)
}

export type OptionsWithDefault<T, K extends string> = {
  options: Record<K, T>
  default: K
}
