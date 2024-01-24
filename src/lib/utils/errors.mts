export class DataLoadError extends Error {
  constructor(message:string, data:string) {
    super(message);
    // Set the prototype explicitly. See https://stackoverflow.com/questions/31626231/custom-error-class-in-typescript
    Object.setPrototypeOf(this, DataLoadError.prototype);
    this.message = message + " Data: " + data;
    this.name = "DataLoadError"; 
  }
}

// Show Progress on key derivation?
// 
