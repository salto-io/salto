import { SaltoElementError } from './error'
import { Element } from './elements'
import { Change } from './change'

export type ChangeValidator = {
  onAdd(after: Element): Promise<ReadonlyArray<ChangeError>>
  onRemove(before: Element): Promise<ReadonlyArray<ChangeError>>
  onUpdate(changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>>
}

export type ChangeError = SaltoElementError & {
  detailedMessage: string
}
