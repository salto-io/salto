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
import { inspect } from 'util'
import { defaultOpts } from '../functions'
import { isPrimitive } from '../values'
import { mutateBottomUpDepthFirst } from '../walker'
import { getRef, RefNode, RefPath, serializeRef, setRef } from './refs'

type ReplacerResult = {
  data: unknown
  refs: Record<string, string[]> // target => refs
  prototypes: Record<string, string[]> // prototypeName => objects
}

const addInObj = <T>(o: Record<string, T[]>, key: string, value: T): void => {
  let entry = o[key]
  if (!entry) {
    entry = []
    o[key] = entry
  }
  entry.push(value)
}

const resolveRefs = (
  { refs, data }: ReplacerResult,
): void => {
  Object.entries(refs).forEach(([targetPathStr, refPaths]) => {
    const target = getRef(data as RefNode, targetPathStr)
    refPaths.forEach(refPathStr => {
      setRef(data as RefNode, refPathStr, target)
    })
  })
}

export class UnknownPrototypeError extends Error {
  constructor(
    readonly prototypeName: string,
    readonly refPaths: string[],
  ) {
    super(`Unknown prototype "${prototypeName}" at paths: ${inspect(refPaths)}`)
  }
}

const revivePrototypes = (
  knownPrototypes: Map<string, object>,
  { prototypes, data }: ReplacerResult,
): void => {
  Object.entries(prototypes).forEach(([prototypeName, refPaths]) => {
    const prototype = knownPrototypes.get(prototypeName)
    if (prototype === undefined) {
      throw new UnknownPrototypeError(prototypeName, refPaths)
    }

    refPaths.forEach(refPathStr => {
      const target = getRef(data as RefNode, refPathStr)
      Object.setPrototypeOf(target, prototype)
    })
  })
}

const revive = (
  replacerResult: ReplacerResult,
  knownPrototypes: Map<string, object>,
): unknown => {
  revivePrototypes(knownPrototypes, replacerResult)
  resolveRefs(replacerResult)
  return replacerResult.data
}

export type JsonSerializer = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(text: string, reviver?: (this: any, key: string, value: any) => any): any
  stringify(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number
  ): string
}

export type JsonSerializerOpts = {
  knownPrototypes: [object, string][]
  useSerializer: JsonSerializer
}

export class DuplicatePrototypeValue extends Error {
  constructor(readonly knownPrototypes: [object, string][]) {
    super(`Duplicate prototype in list of known prototypes: ${inspect(knownPrototypes)}`)
  }
}

const protoToName = (knownPrototypes: [object, string][]): Map<object, string> => {
  const result = new Map<object, string>(knownPrototypes)

  if (result.size !== knownPrototypes.length) {
    throw new DuplicatePrototypeValue(knownPrototypes)
  }

  return result
}

export class DuplicatePrototypeName extends Error {
  constructor(readonly knownPrototypes: [object, string][]) {
    super(`Duplicate name in list of known prototypes: ${inspect(knownPrototypes)}`)
  }
}

const nameToProto = (knownPrototypes: [object, string][]): Map<string, object> => {
  const result = new Map<string, object>(
    knownPrototypes.map(([proto, name]) => [name, proto])
  )

  if (result.size !== knownPrototypes.length) {
    throw new DuplicatePrototypeName(knownPrototypes)
  }

  return result
}

const runReviver = mutateBottomUpDepthFirst

const serializer = (
  { knownPrototypes, useSerializer }: JsonSerializerOpts,
): JsonSerializer => ({
  stringify: (value, innerReplacer, space) => {
    const prototypeToName = protoToName(knownPrototypes)
    const visited = new Map<unknown, RefPath>()
    const refs: Record<string, string[]> = {}
    const prototypes: Record<string, string[]> = {}

    const checkPrototype = (propValue: unknown, refPathStr: string): void => {
      const prototypeName = prototypeToName.get(Object.getPrototypeOf(propValue))
      if (prototypeName !== undefined) {
        addInObj(prototypes, prototypeName, refPathStr)
      }
    }

    const addRef = (targetPath: RefPath, refPathStr: string): void => {
      addInObj(refs, serializeRef(targetPath), refPathStr)
    }

    let initialVisit = true

    function wrappedReplacer(this: unknown, propName: string, propValue: unknown): unknown {
      if (innerReplacer) {
        // eslint-disable-next-line no-param-reassign
        propValue = innerReplacer.call(this, propName, propValue)
      }

      if (initialVisit) { // propName ''
        initialVisit = false
        return propValue
      }

      if (isPrimitive(propValue)) {
        return propValue
      }

      const parentRefPath = visited.get(this)
      const refPath = [...parentRefPath ?? [], propName]
      const refPathStr = serializeRef(refPath)

      const visitedRefPath = visited.get(propValue)

      if (visitedRefPath === undefined) { // object not seen before
        visited.set(propValue, refPath)
        checkPrototype(propValue, refPathStr)
        return propValue
      }

      addRef(visitedRefPath, refPathStr)
      return undefined // remove recurring ref
    }

    const serializedData = useSerializer.stringify(value, wrappedReplacer, space)
    const serializedPrototypes = useSerializer.stringify(prototypes, undefined, space)
    const serializedRefs = useSerializer.stringify(refs, undefined, space)

    return `{"prototypes":${serializedPrototypes},"refs":${serializedRefs},"data":${serializedData}}`
  },

  parse: (text, innerReviver) => {
    const revived = revive(
      useSerializer.parse(text) as ReplacerResult,
      nameToProto(knownPrototypes),
    )

    return innerReviver
      ? runReviver(revived, innerReviver)
      : revived
  },
})

/**
 * Drop-in replacement for JSON.serializer and JSON.parse, with the following features:
 * - Prototypes can be preserved, as long as they are known in advance.
 * - References are kept, including circular references.
 *
 * @example Preserving instances
 *
 * class MyClass { x = 12 }
 * const myInstance = new MyClass()
 *
 * const serializer = jsonSerializer({ knownPrototypes: [[MyClass.prototype, 'MyClass']] })
 * const str = serializer.stringify(myInstance)
 * const revivedInstance = serializer.parse(str) as MyClass
 * console.log(revivedInstance instanceof MyInstance) // true
 * console.log(revivedInstance.x) // 12
 *
 * @example Keeping references
 *
 * const owner = { name: 'john' }
 * const dog = { name: 'bud', owner }
 * const cat = { name: 'lucy', owner }
 *
 * const serializer = jsonSerializer()
 * const str = serializer.stringify([ dog, owner, cat ]) // order does not matter
 * const [dDog, dOwner, dCat] = serializer.parse(str) as [typeof dog, typeof owner, typeof cat]
 * console.log(dDog.owner === dCat.owner) // true
 *
 */
//
//
export const jsonSerializer = defaultOpts<JsonSerializerOpts, JsonSerializer>(
  serializer,
  {
    knownPrototypes: [],
    useSerializer: JSON,
  }
)
