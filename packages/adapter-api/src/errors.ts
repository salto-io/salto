export class CrudError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class AddError extends CrudError {
  constructor(message: string) {
    super(message)
  }
}

export class RemoveError extends CrudError {
  constructor(message: string) {
    super(message)
  }
}
