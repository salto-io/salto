import { Element, ElemID } from './elements'
import { Change } from './change'

export type ChangeValidator = {
  onAdd(after: Element): Promise<ReadonlyArray<ChangeError>>
  onRemove(before: Element): Promise<ReadonlyArray<ChangeError>>
  onUpdate(changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>>
}

export type ErrorLevel = 'WARNING' | 'ERROR'

export type ChangeError = {
  elemID: ElemID
  level: ErrorLevel
  message: string
  detailedMessage: string
}
