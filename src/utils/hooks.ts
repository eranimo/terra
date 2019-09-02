import { useState, useEffect } from "react";
import { Observable } from "rxjs";
import { ObservableDict } from './ObservableDict';


export function useObservable<T>(
  observable: Observable<T>,
  defaultValue: T,
): T {
  const [value, setValue] = useState(defaultValue);

  useEffect(
    () => {
      const subscription = observable.subscribe(setValue);
      return () => subscription.unsubscribe();
    },
    [observable]
  );

  return value;
};

export function useObservableDict<T extends object, K extends keyof T>(
  dict: ObservableDict<T>,
  key: K,
): T[K] {
  return useObservable(dict.ofKey(key), dict.get(key));
}
