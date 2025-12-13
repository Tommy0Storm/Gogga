/**
 * ES2024 Set methods polyfill type definitions
 * These methods are supported in modern browsers but not yet in TypeScript 5.9
 * @see https://github.com/tc39/proposal-set-methods
 */

interface Set<T> {
  /**
   * Returns a new set containing elements that are in both this set and the other set
   */
  intersection(other: ReadonlySetLike<T>): Set<T>;
  
  /**
   * Returns a new set containing elements that are in this set but not in the other set
   */
  difference(other: ReadonlySetLike<T>): Set<T>;
  
  /**
   * Returns a new set containing elements that are in either set but not in both
   */
  symmetricDifference(other: ReadonlySetLike<T>): Set<T>;
  
  /**
   * Returns a new set containing elements from both sets
   */
  union(other: ReadonlySetLike<T>): Set<T>;
  
  /**
   * Returns true if this set has no elements in common with the other set
   */
  isDisjointFrom(other: ReadonlySetLike<T>): boolean;
  
  /**
   * Returns true if all elements of this set are in the other set
   */
  isSubsetOf(other: ReadonlySetLike<T>): boolean;
  
  /**
   * Returns true if all elements of the other set are in this set
   */
  isSupersetOf(other: ReadonlySetLike<T>): boolean;
}

interface ReadonlySetLike<T> {
  /**
   * Despite its name, returns the number of elements in the set-like.
   */
  size: number;
  /**
   * Despite its name, checks if the set-like has a given value.
   */
  has(value: T): boolean;
  /**
   * Despite its name, gives an iterator over all values in the set-like.
   */
  keys(): IterableIterator<T>;
}
