import { types } from '@salto/lowerdash'
import { MergeError } from '../core/merger'
import { ValidationError } from '../core/validator'
import { ParseError } from '../parser/parse'

export class Errors extends types.Bean<Readonly<{
    parse: ReadonlyArray<ParseError>
    merge: ReadonlyArray<MergeError>
    validation: ReadonlyArray<ValidationError>
  }>> {
  hasErrors(): boolean {
    return [this.parse, this.merge, this.validation].some(errors => errors.length > 0)
  }

  strings(): ReadonlyArray<string> {
    return [
      ...this.parse.map(error => error.detail),
      ...this.merge.map(error => error.error),
      ...this.validation.map(error => error.error),
    ]
  }
}
