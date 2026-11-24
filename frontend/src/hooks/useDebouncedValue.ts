import { useEffect, useState } from "react";

// Returns the value only after it has stopped changing for `delayInMilliseconds`.
export function useDebouncedValue<ValueType>(latestValue: ValueType, delayInMilliseconds: number): ValueType {
  const [debouncedValue, setDebouncedValue] = useState(latestValue);
  useEffect(() => {
    const timerId = window.setTimeout(() => setDebouncedValue(latestValue), delayInMilliseconds);
    return () => window.clearTimeout(timerId);
  }, [latestValue, delayInMilliseconds]);
  return debouncedValue;
}
