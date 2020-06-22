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
import wu from 'wu'
import { types } from '@salto-io/lowerdash'
import { SaltoError } from '@salto-io/adapter-api'
import { MergeError } from '../merger'
import { ValidationError } from '../validator'
import { ParseError } from '../parser/parse'

export class Errors extends types.Bean<Readonly<{
    parse: ReadonlyArray<ParseError>
    merge: ReadonlyArray<MergeError>
    validation: ReadonlyArray<ValidationError>
  }>> {
  hasErrors(): boolean {
    return [this.parse, this.merge, this.validation].some(errors => errors.length > 0)
  }

  all(): Iterable<SaltoError> {
    return wu.chain<SaltoError>(this.parse, this.merge, this.validation)
  }

  strings(): ReadonlyArray<string> {
    return [
      ...this.parse.map(error => error.message),
      ...this.merge.map(error => error.error),
      ...this.validation.map(error => error.error),
    ]
  }
}

export class EnvDuplicationError extends Error {
  constructor(envName: string) {
    super(`${envName} is already defined in this workspace`)
  }
}

export class ServiceDuplicationError extends Error {
  constructor(service: string) {
    super(`${service} is already defined in this workspace`)
  }
}

export class UnknownEnvError extends Error {
  constructor(envName: string) {
    super(`Unkown environment ${envName}`)
  }
}

export class DeleteCurrentEnvError extends Error {
  constructor(envName: string) {
    super(`Cannot delete the current env: ${envName}`)
  }
}

export class NoWorkspaceConfig extends Error {
  constructor() {
    super('cannot find workspace config')
  }
}
