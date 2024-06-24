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
import { types } from '@salto-io/lowerdash'
import { SaltoError, SeverityLevel } from '@salto-io/adapter-api'
import { parser } from '@salto-io/parser'
import { MergeError } from '../merger'
import { ValidationError } from '../validator'

export const MAX_ENV_NAME_LEN = 100

export class Errors extends types.Bean<
  Readonly<{
    parse: ReadonlyArray<parser.ParseError>
    merge: ReadonlyArray<MergeError>
    validation: ReadonlyArray<ValidationError>
  }>
> {
  all(severity?: SeverityLevel): Iterable<SaltoError> {
    const allErrors = wu.chain<SaltoError>(this.parse, this.merge, this.validation)
    return severity ? allErrors.filter(error => error.severity === severity) : allErrors
  }

  hasErrors(severity?: SeverityLevel): boolean {
    return wu(this.all(severity)).some(() => true)
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

export class InvalidEnvNameError extends Error {
  constructor(envName: string) {
    super(
      `The environment name: "${envName}" is invalid. Make sure your name meets the following rules:
        - Contains only alphanumeric or one of the following special characters: _-.!
        - Cannot exceed ${MAX_ENV_NAME_LEN} chars`,
    )
  }
}

export class InvalidAccountNameError extends Error {
  constructor(accountName: string) {
    super(
      `${accountName} is an invalid account name.\nAccount names should include only alphanumeric characters or '_'`,
    )
  }
}

export class AccountDuplicationError extends Error {
  constructor(account: string) {
    super(`${account} is already defined in this workspace`)
  }
}

export class UnknownAccountError extends Error {
  constructor(account: string) {
    super(`${account} is not defined as an account in this workspace`)
  }
}

export class UnknownEnvError extends Error {
  constructor(envName: string) {
    super(`Unknown environment ${envName}`)
  }
}

export class DeleteCurrentEnvError extends Error {
  constructor(envName: string) {
    super(`Cannot delete the current env: ${envName}\nPlease set the current environment to another one and try again.`)
  }
}
