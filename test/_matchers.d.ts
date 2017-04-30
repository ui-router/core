
declare namespace jasmine {
  interface Matchers<T> {
    toEqualData(x: any): boolean;
    toEqualValues(x: any): boolean;
  }
}
