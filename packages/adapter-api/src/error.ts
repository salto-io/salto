import { ElemID } from './element_id'

export type SaltoErrorSeverity = 'Error' | 'Warning'

export type SaltoError = {
    message: string
    severity: SaltoErrorSeverity
}

export type SaltoElementError = SaltoError & {
    elemID: ElemID
}
