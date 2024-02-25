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
import wu from 'wu'

export type SetId = number | string

export const update = <T>(target: Set<T>, source: Iterable<T>): void => {
  wu(source).forEach(target.add.bind(target))
}

export const intersection = <T>(s1: Iterable<T>, s2: Set<T>): Set<T> => new Set<T>(wu(s1).filter(i => s2.has(i)))

export const difference = <T>(s1: Iterable<T>, s2: Set<T>): Set<T> => new Set<T>(wu(s1).filter(i => !s2.has(i)))

export const equals = <T>(s1: Set<T>, s2: Set<T>): boolean => s1.size === s2.size && difference(s1, s2).size === 0
