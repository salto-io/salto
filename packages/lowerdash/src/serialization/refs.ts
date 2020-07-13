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
export type RefPath = string[]

export type RefNode = {
  [key: string]: RefNode | unknown
}

const navigateTo = (root: RefNode, path: string): [string, RefNode] => {
  const parts = path.split(/(?<!\\)\./).map(p => p.replace(/\\\./g, '.'))
  let o = root
  for (let i = 0; i < parts.length - 1; i += 1) {
    o = o[parts[i]] as RefNode
  }
  return [parts[parts.length - 1], o]
}

export const getRef = (root: RefNode, path: string): unknown => {
  const [propName, object] = navigateTo(root, path)
  return object[propName]
}

export const setRef = (root: RefNode, path: string, value: unknown): void => {
  const [propName, object] = navigateTo(root, path)
  object[propName] = value
}

export const serializeRef = (paths: string[]): string => paths
  .map(p => p.replace(/\./g, '\\.'))
  .join('.')
