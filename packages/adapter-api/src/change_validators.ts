import { Element, ElemID } from './elements'
import { Change } from './change'

export type ChangeValidator = {
  onAdd(after: Element): ReadonlyArray<ChangeError>
  onRemove(before: Element): ReadonlyArray<ChangeError>
  onUpdate(changes: ReadonlyArray<Change>): ReadonlyArray<ChangeError>
}

export type ErrorLevel = 'WARNING' | 'ERROR'

export type ChangeError = {
  elemID: ElemID
  level: ErrorLevel
  message: string
  detailedMessage: string
}
